#!/usr/bin/env bash
# Purge Cloudflare's cache for what a deploy actually changed — the last step of the Pages deploy.
#
# anecdote.channel is served AS-IS via GitHub Pages behind Cloudflare (no Jekyll build — pages.yml uploads
# the repo root), so DISK PATH == URL PATH and a changed file maps to exactly ONE changed URL. That makes
# this precise by nature: purge each changed file's URL. We fall back to purging the whole zone only when
# there's no diff to inspect (schedule / workflow_dispatch / first push) or the diff can't be read.
#
# Env (set by the workflow):
#   CLOUDFLARE_API_TOKEN  token scoped to Zone > Cache Purge   (empty => no-op, unless DRYRUN)
#   CLOUDFLARE_ZONE_ID    the zone id                          (empty => no-op, unless DRYRUN)
#   SITE_URL              site origin (default https://anecdote.channel)
#   EVENT                 github.event_name
#   BEFORE_SHA            github.event.before (push only)
#   AFTER_SHA             github.sha
#   DRYRUN                if set, print the plan and make no network calls (needs no token)
set -uo pipefail

DRY="${DRYRUN:-}"
if [ -z "$DRY" ] && { [ -z "${CLOUDFLARE_API_TOKEN:-}" ] || [ -z "${CLOUDFLARE_ZONE_ID:-}" ]; }; then
  # Name what is missing, not just that something is. A silent no-op here is indistinguishable
  # from a working purge, and looks exactly like a site that will not refresh.
  miss=""
  [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && miss="CLOUDFLARE_API_TOKEN"
  [ -z "${CLOUDFLARE_ZONE_ID:-}" ] && miss="${miss:+$miss and }CLOUDFLARE_ZONE_ID (as a repo Variable or Secret)"
  echo "::warning title=Cache not purged::$miss not set — skipping cache purge, so Cloudflare will keep serving the previous bytes"
  exit 0
fi

api="https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID:-DRYRUN}/purge_cache"
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN:-}" -H "Content-Type: application/json")
site_url="${SITE_URL:-https://anecdote.channel}"; site_url="${site_url%/}"


# ONE CALL, AND IT CHECKS. `curl -fsS ... | jq` looks careful and is not: the pipeline's status is
# JQ's, so a refused request leaves `set -e` untouched and the job green. That is how a 401 sat in
# the log under a passing run — the same shape as the missing zone id it was hiding behind.
cf_purge_call() { # $1 = json body
  local out code
  out="$(curl -sS -w $'\n%{http_code}' "${auth[@]}" "$api" --data "$1" 2>&1)" || true
  code="${out##*$'\n'}"; out="${out%$'\n'*}"
  if [ "$code" = "200" ] && printf '%s' "$out" | grep -q '"success":[[:space:]]*true'; then
    echo "purge: ok"
    return 0
  fi
  # SAY WHICH TOKEN THIS IS. An account accumulates tokens, several with identical permissions,
  # and "which one is in the secret" is otherwise answerable only by elimination. /user/tokens/verify
  # authenticates the token against itself, so it answers even when the token lacks the permission
  # the purge needed. The ID is an identifier, not a credential — it is the one shown in the
  # dashboard URL — so it is safe to print and is exactly what makes the row findable.
  local who wid wstatus
  who="$(curl -sS "${auth[@]}" "https://api.cloudflare.com/client/v4/user/tokens/verify" 2>&1 || true)"
  wid="$(printf '%s' "$who" | sed -n 's/.*"id":"\([0-9a-f]*\)".*/\1/p' | head -1)"
  wstatus="$(printf '%s' "$who" | sed -n 's/.*"status":"\([a-z]*\)".*/\1/p' | head -1)"
  echo "::warning title=Cache not purged::Cloudflare refused the purge (HTTP ${code:-no response}) — the deploy is live but the cache still holds the previous bytes. Cloudflare reports a MISSING PERMISSION the same way it reports a bad token — HTTP 401, error 10000 \"Authentication error\" — so check the token has Zone → Cache Purge on this zone before assuming it expired. A token that works for certificate packs (acm-sync) can still be refused here. Token in CLOUDFLARE_API_TOKEN: id=${wid:-unidentified} status=${wstatus:-unknown}. Response: ${out}"
  return 1
}

purge_everything() {
  echo "purge: everything ($1)"
  [ -n "$DRY" ] && return 0
  cf_purge_call '{"purge_everything":true}' || true
}

purge_files() { # args: absolute urls; Cloudflare accepts up to 30 per request, so batch
  local all=("$@") i
  for ((i = 0; i < ${#all[@]}; i += 30)); do
    local batch=("${all[@]:i:30}") body
    echo "purge: ${#batch[@]} url(s)"; printf '  %s\n' "${batch[@]}"
    [ -n "$DRY" ] && continue
    body="$(printf '%s\n' "${batch[@]}" | jq -R . | jq -s '{files: .}')"
    cf_purge_call "$body" || true
  done
}

# --- decide precise vs everything -------------------------------------------
zero="0000000000000000000000000000000000000000"
if [ "${EVENT:-}" != "push" ] || [ -z "${BEFORE_SHA:-}" ] || [ "${BEFORE_SHA}" = "$zero" ]; then
  purge_everything "no diff range: ${EVENT:-unknown}"; exit 0
fi

changed="$(git diff --name-only "$BEFORE_SHA" "$AFTER_SHA" 2>/dev/null)" || { purge_everything "diff failed"; exit 0; }
[ -z "$changed" ] && { echo "purge: nothing changed"; exit 0; }

# --- precise: disk path == url path -----------------------------------------
urls=()
emit_url() { # repo-relative path -> served url(s)
  local p="$1"
  case "$p" in
    index.html)   urls+=("${site_url}/" "${site_url}/index.html") ;;                 # root
    */index.html) urls+=("${site_url}/${p%index.html}" "${site_url}/${p}") ;;        # dir/ and dir/index.html
    *)            urls+=("${site_url}/${p}") ;;                                       # any other file (and deletions)
  esac
}
while IFS= read -r path; do
  [ -z "$path" ] && continue
  emit_url "$path"
done <<< "$changed"

mapfile -t urls < <(printf '%s\n' "${urls[@]}" | awk 'NF && !seen[$0]++')
[ "${#urls[@]}" -eq 0 ] && { echo "purge: no urls"; exit 0; }
purge_files "${urls[@]}"
