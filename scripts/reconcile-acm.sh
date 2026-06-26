#!/usr/bin/env bash
#
# reconcile-acm.sh — make Cloudflare's ACM advanced certificate match config/san-list.txt
#
# This script is the whole automation. It does NOT issue certificates or touch
# private keys: Cloudflare's Advanced Certificate Manager issues and auto-renews
# the cert. This script only keeps the *set of covered hostnames* in sync with
# the repo, by ordering a new advanced certificate pack when the desired host
# list changes and pruning the superseded pack(s).
#
# Model: this script manages a SINGLE advanced certificate pack per zone (the
# full host list must fit within Cloudflare's 50-host limit). It treats every
# `type == "advanced"` pack in the zone as repo-managed and converges the zone
# to exactly one advanced pack whose hosts equal the config. The zone's free
# Universal SSL pack (`type == "universal"`) is never touched. If the curated
# list ever needs to exceed 50 hosts, this script must be extended to shard the
# list across multiple packs — it intentionally aborts rather than truncate.
#
# Idempotent and fail-closed:
#   * If an advanced pack already matches the config exactly -> no-op.
#   * A new pack is ordered and polled to `active` BEFORE any old pack is
#     deleted (order-before-delete = no coverage gap).
#   * Stale packs are deleted only after the new pack is verified active.
#
# Required environment:
#   CLOUDFLARE_API_TOKEN   zone-scoped token: SSL and Certificates:Edit + Zone:Read
#   CF_ZONE_ID             the zone id for anecdote.channel
#
# Usage:
#   scripts/reconcile-acm.sh [--dry-run] [--config PATH]
#
set -euo pipefail

# ---- configuration ----------------------------------------------------------
API="https://api.cloudflare.com/client/v4"
CONFIG="config/san-list.txt"
DRY_RUN=0
CA="lets_encrypt"          # certificate_authority: lets_encrypt | google | ssl_com
VALIDATION="txt"           # validation_method:     txt | http | email
VALIDITY=90                # validity_days:         14 | 30 | 90 | 365
MAX_HOSTS=50               # Cloudflare hard limit per advanced pack (apex included)
POLL_ATTEMPTS=40           # ~10 minutes at 15s spacing
POLL_INTERVAL=15

# ---- arg parsing ------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --config)  CONFIG="${2:?--config needs a path}"; shift 2 ;;
    -h|--help) sed -n '2,40p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }
log() { echo "+ $*" >&2; }

command -v jq   >/dev/null || die "jq is required"
command -v curl >/dev/null || die "curl is required"
[[ -n "${CLOUDFLARE_API_TOKEN:-}" ]] || die "CLOUDFLARE_API_TOKEN is not set"
[[ -n "${CF_ZONE_ID:-}" ]]           || die "CF_ZONE_ID is not set"
[[ -f "$CONFIG" ]]                   || die "config not found: $CONFIG"

# ---- Cloudflare API wrapper -------------------------------------------------
# cf METHOD PATH [json-body]  -> prints `.result` on success, aborts otherwise.
# The token is passed via header (never on argv) so it cannot leak through ps.
cf() {
  local method="$1" path="$2" body="${3:-}" resp
  if [[ -n "$body" ]]; then
    resp=$(curl -sS -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
      -H "Content-Type: application/json" \
      --data "$body")
  else
    resp=$(curl -sS -X "$method" "${API}${path}" \
      -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}")
  fi
  if [[ "$(jq -r '.success' <<<"$resp")" != "true" ]]; then
    echo "Cloudflare API error on ${method} ${path}:" >&2
    jq -r '.errors' <<<"$resp" >&2
    exit 1
  fi
  jq -c '.result' <<<"$resp"
}

# ---- 1. read + normalize + validate desired hosts ---------------------------
# strip comments/blanks, trim, lowercase, dedupe, sort.
mapfile -t HOSTS < <(
  sed -e 's/#.*//' "$CONFIG" \
    | tr 'A-Z' 'a-z' \
    | tr -d '[:blank:]' \
    | grep -v '^$' \
    | sort -u
)

[[ ${#HOSTS[@]} -gt 0 ]] || die "config has no hostnames"
[[ ${#HOSTS[@]} -le $MAX_HOSTS ]] || die \
  "config has ${#HOSTS[@]} hosts; Cloudflare allows max ${MAX_HOSTS} per advanced pack. Shard the list (see script header)."

APEX="anecdote.channel"
printf '%s\n' "${HOSTS[@]}" | grep -qx "$APEX" || die "apex '$APEX' must be present in $CONFIG"

for h in "${HOSTS[@]}"; do
  case "$h" in
    \*.\*.*|\*)        die "invalid wildcard '$h': only single-label wildcards (leading '*.') are allowed" ;;
    *\**) [[ "$h" == \*.* ]] || die "invalid wildcard '$h': '*' may only appear as the leading label" ;;
  esac
  [[ "$h" == *.anecdote.channel || "$h" == "$APEX" ]] \
    || die "host '$h' is not under the apex '$APEX'"
done

# canonical, sorted JSON array of desired hosts (for comparison + ordering)
DESIRED_JSON=$(printf '%s\n' "${HOSTS[@]}" | jq -R . | jq -cs 'sort')
log "desired hosts (${#HOSTS[@]}): $(jq -rc 'join(", ")' <<<"$DESIRED_JSON")"

# ---- 2. list existing advanced packs ----------------------------------------
PACKS=$(cf GET "/zones/${CF_ZONE_ID}/ssl/certificate_packs?per_page=50&status=all")
ADV=$(jq -c '[.[] | select(.type == "advanced")]' <<<"$PACKS")
log "existing advanced packs: $(jq 'length' <<<"$ADV")"

# ---- 3. already in sync? ----------------------------------------------------
# A pack matches if its sorted host set equals the desired set.
MATCH_ID=$(jq -r --argjson want "$DESIRED_JSON" \
  'map(select((.hosts | sort) == $want)) | (.[0].id // empty)' <<<"$ADV")

if [[ -n "$MATCH_ID" ]]; then
  # Drop any *extra* advanced packs that don't match (drift cleanup), keep the match.
  STALE=$(jq -r --arg keep "$MATCH_ID" '.[] | select(.id != $keep) | .id' <<<"$ADV")
  if [[ -z "$STALE" ]]; then
    log "in sync (pack ${MATCH_ID}); nothing to do"
    exit 0
  fi
  log "in sync (pack ${MATCH_ID}); pruning ${STALE//$'\n'/ } stale advanced pack(s)"
  if [[ $DRY_RUN -eq 1 ]]; then log "[dry-run] would delete: ${STALE//$'\n'/ }"; exit 0; fi
  while read -r id; do [[ -n "$id" ]] && cf DELETE "/zones/${CF_ZONE_ID}/ssl/certificate_packs/${id}" >/dev/null && log "deleted $id"; done <<<"$STALE"
  exit 0
fi

# ---- 4. order a new advanced pack -------------------------------------------
ORDER_BODY=$(jq -cn --argjson hosts "$DESIRED_JSON" \
  --arg ca "$CA" --arg vm "$VALIDATION" --argjson vd "$VALIDITY" \
  '{type:"advanced", hosts:$hosts, certificate_authority:$ca, validation_method:$vm, validity_days:$vd, cloudflare_branding:false}')

if [[ $DRY_RUN -eq 1 ]]; then
  log "[dry-run] would order advanced pack:"
  jq . <<<"$ORDER_BODY" >&2
  OLD=$(jq -r '.[].id' <<<"$ADV")
  [[ -n "$OLD" ]] && log "[dry-run] would then delete superseded pack(s): ${OLD//$'\n'/ }"
  exit 0
fi

NEW=$(cf POST "/zones/${CF_ZONE_ID}/ssl/certificate_packs/order" "$ORDER_BODY")
NEW_ID=$(jq -r '.id' <<<"$NEW")
[[ -n "$NEW_ID" && "$NEW_ID" != "null" ]] || die "order did not return a pack id"
log "ordered advanced pack ${NEW_ID}; waiting for it to become active"

# ---- 5. poll the new pack until active --------------------------------------
status=""
for ((i=1; i<=POLL_ATTEMPTS; i++)); do
  PACK=$(cf GET "/zones/${CF_ZONE_ID}/ssl/certificate_packs/${NEW_ID}")
  status=$(jq -r '.status' <<<"$PACK")
  log "  attempt ${i}/${POLL_ATTEMPTS}: status=${status}"
  [[ "$status" == "active" ]] && break
  sleep "$POLL_INTERVAL"
done
[[ "$status" == "active" ]] || die "pack ${NEW_ID} did not reach 'active' (last status: ${status}). Not deleting any old pack."

# ---- 6. prune the superseded advanced pack(s) -------------------------------
OLD=$(jq -r --arg new "$NEW_ID" '.[] | select(.id != $new) | .id' <<<"$ADV")
while read -r id; do
  [[ -n "$id" ]] || continue
  cf DELETE "/zones/${CF_ZONE_ID}/ssl/certificate_packs/${id}" >/dev/null && log "deleted superseded pack $id"
done <<<"$OLD"

log "done: pack ${NEW_ID} active and covering ${#HOSTS[@]} hosts"
