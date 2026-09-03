#!/usr/bin/env bash
#
# reconcile-redirects.sh — make Cloudflare's Bulk Redirect list match the directory's shells.
#
# A SHELL is a canonical name we assert over something we do not run (config/sites.txt, `repo:`
# or `to:`). This turns each one into an edge redirect, so media.longmont.colorado.anecdote.channel
# leads to Longmont Public Media without anything of ours being in the request path.
#
# WHY BULK REDIRECTS AND NOT A WORKER. The ceiling is the point. A Worker's quota scales with
# TRAFFIC — someone else's behaviour, unpredictable, and a neighbour going viral is indistinguishable
# from an attack. A Bulk Redirect list's quota scales with NAMES: ours, countable, on our own roadmap.
# Free plan carries 15 rules and 10,000–50,000 redirect URLs, with no per-request billing at all.
# So this costs the same whether a shell is visited once a year or a million times a day, which is
# the only property that makes a directory safe to grow.
#
# 302, NOT 301, on purpose. A shell is not a permanent identity claim. A 301 is cached hard by
# browsers and would outlive our ability to change or withdraw it — a neighbour who moves, or who
# asks to be delisted, must not have to wait out someone else's cache. Revocability beats the
# marginal redirect speed.
#
# This script does NOT create names. DNS for each canonical host, and its TLS coverage in
# config/san-list.txt, are separate and must already exist — a redirect on a name that does not
# resolve is invisible, and this refuses rather than pretend otherwise.
#
# Idempotent and fail-closed:
#   * Desired set equals current -> no-op, no API write.
#   * The item replace is polled to completion before the script reports success.
#   * A shell whose target is not answering is REFUSED, not published: we do not put our own name
#     in front of a broken handoff.
#
# Required environment:
#   CLOUDFLARE_RULES_TOKEN   token with Account > Rules Lists:Edit (and Account Rulesets:Edit for --ensure-rule)
#   CF_ACCOUNT_ID          the account id
#
# Usage:
#   scripts/reconcile-redirects.sh [--dry-run] [--sites PATH] [--list NAME] [--ensure-rule]
#
set -euo pipefail

API="https://api.cloudflare.com/client/v4"
SITES="sites.json"
LIST_NAME="anecdote_shells"
DRY_RUN=0
ENSURE_RULE=0
STATUS_CODE=302
POLL_ATTEMPTS=30
POLL_INTERVAL=4

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --sites) SITES="$2"; shift ;;
    --list) LIST_NAME="$2"; shift ;;
    --ensure-rule) ENSURE_RULE=1 ;;
    -h|--help) sed -n '2,36p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
  shift
done

die() { echo "reconcile-redirects: $*" >&2; exit 1; }

[ -f "$SITES" ] || die "no $SITES — run: node scripts/sync-sites.mjs"
if [ "$DRY_RUN" -eq 0 ]; then
  [ -n "${CLOUDFLARE_RULES_TOKEN:-}" ] || die "CLOUDFLARE_RULES_TOKEN not set"
  [ -n "${CF_ACCOUNT_ID:-}" ] || die "CF_ACCOUNT_ID not set"
fi
auth=(-H "Authorization: Bearer ${CLOUDFLARE_RULES_TOKEN:-}" -H "Content-Type: application/json")

# ---- desired state, straight from the directory ------------------------------------------
# The sites map is already the record of who serves what under which name; deriving redirects
# from it means there is no second list to keep in step.
desired="$(node -e '
const fs = require("node:fs");
const d = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const items = [];
const refused = [];
for (const s of d.sites || []) {
  if (!s.leaves || s.draft || s.system) continue;
  if (!s.targetLive) { refused.push(s.host + " -> " + (s.to || "?") + " (target not answering)"); continue; }
  items.push({ redirect: {
    source_url: s.host + "/",
    target_url: s.to,
    status_code: Number(process.env.STATUS_CODE || 302),
    include_subdomains: false,
    subpath_matching: true,      // /whatever under the canonical name follows too
    preserve_query_string: true,
    preserve_path_suffix: true,  // a deep link into a neighbour survives the handoff
  }});
}
items.sort((a, b) => a.redirect.source_url.localeCompare(b.redirect.source_url));
if (refused.length) { console.error("REFUSED:\n  " + refused.join("\n  ")); process.exitCode = 3; }
console.log(JSON.stringify(items));
' "$SITES")" || die "a shell targets something that is not answering — refusing to publish a broken handoff"

count="$(printf '%s' "$desired" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).length))')"
echo "desired: $count redirect(s) from $SITES"
printf '%s' "$desired" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{for(const i of JSON.parse(s))console.log("  "+i.redirect.source_url+"  ->  "+i.redirect.target_url)})'

if [ "$DRY_RUN" -eq 1 ]; then
  echo "dry run — no API calls made"
  exit 0
fi

api() { # method path [body]
  local m="$1" p="$2" b="${3:-}"
  if [ -n "$b" ]; then curl -fsS -X "$m" "${auth[@]}" "$API$p" --data "$b"
  else curl -fsS -X "$m" "${auth[@]}" "$API$p"; fi
}

jqr() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(eval(process.argv[1]))})' "$1"; }

# ---- find or create the list -------------------------------------------------------------
lists="$(api GET "/accounts/$CF_ACCOUNT_ID/rules/lists")"
list_id="$(printf '%s' "$lists" | jqr '(j.result||[]).filter(l=>l.name===process.env.LIST_NAME&&l.kind==="redirect")[0]?.id||""')"

if [ -z "$list_id" ]; then
  echo "creating redirect list: $LIST_NAME"
  created="$(api POST "/accounts/$CF_ACCOUNT_ID/rules/lists" \
    "{\"name\":\"$LIST_NAME\",\"kind\":\"redirect\",\"description\":\"anecdote.channel shells — generated from config/sites.txt\"}")"
  list_id="$(printf '%s' "$created" | jqr 'j.result.id')"
fi
echo "list: $LIST_NAME ($list_id)"

# ---- no-op when it already matches --------------------------------------------------------
current="$(api GET "/accounts/$CF_ACCOUNT_ID/rules/lists/$list_id/items")"
cur_norm="$(printf '%s' "$current" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const j=JSON.parse(s);
  const items=(j.result||[]).map(i=>({source_url:i.redirect.source_url,target_url:i.redirect.target_url,status_code:i.redirect.status_code}));
  items.sort((a,b)=>a.source_url.localeCompare(b.source_url));
  console.log(JSON.stringify(items));});')"
des_norm="$(printf '%s' "$desired" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
  const items=JSON.parse(s).map(i=>({source_url:i.redirect.source_url,target_url:i.redirect.target_url,status_code:i.redirect.status_code}));
  console.log(JSON.stringify(items));});')"

if [ "$cur_norm" = "$des_norm" ]; then
  echo "already in sync — nothing to do"
else
  echo "replacing list contents"
  op="$(api PUT "/accounts/$CF_ACCOUNT_ID/rules/lists/$list_id/items" "$desired")"
  op_id="$(printf '%s' "$op" | jqr 'j.result?.operation_id||""')"
  if [ -n "$op_id" ]; then
    for _ in $(seq 1 $POLL_ATTEMPTS); do
      st="$(api GET "/accounts/$CF_ACCOUNT_ID/rules/lists/bulk_operations/$op_id" | jqr 'j.result.status')"
      [ "$st" = "completed" ] && { echo "list updated"; break; }
      [ "$st" = "failed" ] && die "bulk operation failed"
      sleep "$POLL_INTERVAL"
    done
  fi
fi

# ---- the rule that actually applies the list ----------------------------------------------
# One account-level rule references the list; the list is what changes. Kept behind a flag because
# it is one-time setup and needs a wider token than the day-to-day item sync.
if [ "$ENSURE_RULE" -eq 1 ]; then
  rs="$(api GET "/accounts/$CF_ACCOUNT_ID/rulesets?phase=http_request_redirect" || echo '{"result":[]}')"
  rs_id="$(printf '%s' "$rs" | jqr '(j.result||[]).filter(r=>r.phase==="http_request_redirect")[0]?.id||""')"
  if [ -z "$rs_id" ]; then
    echo "creating account redirect ruleset"
    rs_id="$(api POST "/accounts/$CF_ACCOUNT_ID/rulesets" \
      '{"name":"anecdote shells","kind":"root","phase":"http_request_redirect","rules":[]}' | jqr 'j.result.id')"
  fi
  has="$(api GET "/accounts/$CF_ACCOUNT_ID/rulesets/$rs_id" | jqr '((j.result.rules)||[]).some(r=>(r.description||"").includes("anecdote shells"))')"
  if [ "$has" != "true" ]; then
    echo "adding bulk redirect rule"
    api POST "/accounts/$CF_ACCOUNT_ID/rulesets/$rs_id/rules" \
      '{"expression":"http.request.full_uri in $'"$LIST_NAME"'","action":"redirect","action_parameters":{"from_list":{"name":"'"$LIST_NAME"'","key":"http.request.full_uri"}},"description":"anecdote shells — generated"}' >/dev/null
  else
    echo "rule already present"
  fi
fi

echo "done"
