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
  echo "::notice::CLOUDFLARE_API_TOKEN / CLOUDFLARE_ZONE_ID not set — skipping cache purge"
  exit 0
fi

api="https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID:-DRYRUN}/purge_cache"
auth=(-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN:-}" -H "Content-Type: application/json")
site_url="${SITE_URL:-https://anecdote.channel}"; site_url="${site_url%/}"

purge_everything() {
  echo "purge: everything ($1)"
  [ -n "$DRY" ] && return 0
  curl -fsS "${auth[@]}" "$api" --data '{"purge_everything":true}' \
    | (jq -r 'if .success then "purge: ok" else "purge FAILED: \(.errors)" end' 2>/dev/null || cat)
}

purge_files() { # args: absolute urls; Cloudflare accepts up to 30 per request, so batch
  local all=("$@") i
  for ((i = 0; i < ${#all[@]}; i += 30)); do
    local batch=("${all[@]:i:30}") body
    echo "purge: ${#batch[@]} url(s)"; printf '  %s\n' "${batch[@]}"
    [ -n "$DRY" ] && continue
    body="$(printf '%s\n' "${batch[@]}" | jq -R . | jq -s '{files: .}')"
    curl -fsS "${auth[@]}" "$api" --data "$body" \
      | (jq -r 'if .success then "purge: ok" else "purge FAILED: \(.errors)" end' 2>/dev/null || cat)
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
