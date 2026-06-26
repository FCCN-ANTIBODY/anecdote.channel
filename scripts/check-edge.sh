#!/usr/bin/env bash
#
# check-edge.sh — verify a hostname is served through Cloudflare's edge by a
# certificate that actually covers it (i.e. the ACM advanced cert, not the
# narrower Universal cert or a direct-to-GitHub-Pages origin cert).
#
# For each hostname it reports three independent signals and a verdict:
#   1. DNS    — does it resolve to Cloudflare (proxied) or GitHub Pages (grey)?
#   2. HTTP   — does the response carry `server: cloudflare` + a `cf-ray` header?
#   3. TLS    — issuer + SANs of the served cert, and whether they cover the host.
#
# Verdicts:
#   OK       — proxied through Cloudflare AND the served cert covers the host
#              with more than the Universal pair (the edge/advanced cert is live).
#   GREY     — not proxied yet (direct to GitHub Pages / origin). Expected mid-
#              onboarding: add DNS record grey -> provision Pages cert -> orange.
#   PROBLEM  — proxied but the served cert does NOT cover the host (would throw a
#              name-mismatch in browsers), or the host doesn't resolve / TLS failed.
#
# NOTE: the TLS check reflects whatever cert the *runner's* network sees. On a
# network that intercepts TLS (corporate proxy, some CI sandboxes), the issuer/
# SANs will be the interceptor's, not Cloudflare's — run from a normal network
# for an accurate cert read. The DNS and header signals are not affected.
#
# Usage:
#   scripts/check-edge.sh <host> [<host> ...]
#   scripts/check-edge.sh --md <host> ...      # emit a Markdown table for reports
#
# Exit code: number of hosts whose verdict was not OK (0 = all good).

set -uo pipefail

MD=0
HOSTS=()
while [[ $# -gt 0 ]]; do
  case "$1" in
    --md) MD=1; shift ;;
    -h|--help) sed -n '2,33p' "$0"; exit 0 ;;
    -*) echo "unknown argument: $1" >&2; exit 2 ;;
    *) HOSTS+=("$1"); shift ;;
  esac
done
[[ ${#HOSTS[@]} -gt 0 ]] || { echo "usage: $0 [--md] <host> [<host> ...]" >&2; exit 2; }

command -v openssl >/dev/null || { echo "openssl is required" >&2; exit 2; }
command -v curl    >/dev/null || { echo "curl is required" >&2; exit 2; }

# Known GitHub Pages anycast addresses (grey-cloud tell).
GH_IPS='185.199.108.153 185.199.109.153 185.199.110.153 185.199.111.153'
gh_ip()  { case " $GH_IPS " in *" $1 "*) return 0 ;; esac; [[ "$1" == 2606:50c0:800* ]]; }
# Cloudflare anycast ranges (proxied tell) — heuristic; the cf-ray header is authoritative.
cf_ip()  { [[ "$1" =~ ^104\.(1[6-9]|2[0-9]|3[01])\. ]] || [[ "$1" =~ ^172\.(6[4-9]|7[01])\. ]] || [[ "$1" == 2606:4700:* ]]; }

# Does cert SAN `$2` cover host `$1`? (exact, or single-label leading wildcard.)
san_covers() {
  local host="$1" san="$2"
  [[ "$san" == "$host" ]] && return 0
  if [[ "$san" == \*.* ]]; then
    local suffix="${san#*.}"
    [[ "$host" == *.* && "${host#*.}" == "$suffix" ]] && return 0
  fi
  return 1
}

[[ $MD -eq 1 ]] && {
  echo "| Host | DNS | Proxied | Cert issuer | Covers host | Verdict |"
  echo "|------|-----|---------|-------------|-------------|---------|"
}

failures=0
for host in "${HOSTS[@]}"; do
  # --- 1. DNS ---------------------------------------------------------------
  mapfile -t ips < <(getent ahosts "$host" 2>/dev/null | awk '{print $1}' | sort -u)
  dns_label="none"; proxied_by_ip=0
  if [[ ${#ips[@]} -gt 0 ]]; then
    local_cf=0 local_gh=0
    for ip in "${ips[@]}"; do
      if cf_ip "$ip"; then local_cf=1; elif gh_ip "$ip"; then local_gh=1; fi
    done
    if   [[ $local_cf -eq 1 ]]; then dns_label="Cloudflare"; proxied_by_ip=1
    elif [[ $local_gh -eq 1 ]]; then dns_label="GitHub Pages"
    else dns_label="other (${ips[0]})"; fi
  fi

  # --- 2. HTTP headers ------------------------------------------------------
  headers="$(timeout 15 curl -sS -o /dev/null -D - "https://$host" 2>/dev/null)" || headers=""
  server="$(grep -i '^server:'  <<<"$headers" | head -1 | tr -d '\r' | cut -d' ' -f2-)"
  cfray="$(grep -i '^cf-ray:'   <<<"$headers" | head -1 | tr -d '\r' | cut -d' ' -f2-)"
  proxied=0
  [[ -n "$cfray" ]] && proxied=1
  [[ "$server" == *[Cc]loudflare* ]] && proxied=1
  [[ $proxied_by_ip -eq 1 ]] && proxied=1

  # --- 3. TLS cert ----------------------------------------------------------
  cert="$(timeout 12 bash -c "echo | openssl s_client -connect '$host:443' -servername '$host' 2>/dev/null | openssl x509 -noout -issuer -ext subjectAltName 2>/dev/null")" || cert=""
  issuer="$(grep -i '^issuer=' <<<"$cert" | sed 's/^issuer=//' | head -1)"
  issuer_short="unknown"
  case "$issuer" in
    *"Let's Encrypt"*)  issuer_short="Let's Encrypt" ;;
    *"Google Trust"*)   issuer_short="Google Trust" ;;
    *SSL.com*)          issuer_short="SSL.com" ;;
    *GitHub*)           issuer_short="GitHub" ;;
    "" )                issuer_short="(no cert read)" ;;
    *)                  issuer_short="$(sed -n 's/.*O = \([^,]*\).*/\1/p' <<<"$issuer")"; [[ -z "$issuer_short" ]] && issuer_short="other" ;;
  esac
  mapfile -t sans < <(grep -oE 'DNS:[^,]+' <<<"$cert" | sed 's/^DNS://; s/[[:space:]]//g' | sort -u)
  covers=0
  for s in "${sans[@]:-}"; do san_covers "$host" "$s" && { covers=1; break; }; done
  # Universal = exactly {apex, *.apex}; anything broader that still covers = advanced/edge.
  san_count=${#sans[@]}
  universal=0
  [[ $san_count -eq 2 ]] && printf '%s\n' "${sans[@]}" | grep -q '^\*\.' && universal=1

  # --- verdict --------------------------------------------------------------
  if [[ ${#ips[@]} -eq 0 ]]; then
    verdict="PROBLEM (does not resolve)"
  elif [[ -z "$cert" ]]; then
    verdict="UNKNOWN (TLS not read — see note; check DNS/headers above)"
  elif [[ $proxied -eq 1 && $covers -eq 1 && $universal -eq 0 ]]; then
    verdict="OK (edge cert serving this host)"
  elif [[ $proxied -eq 1 && $covers -eq 1 && $universal -eq 1 ]]; then
    verdict="OK-ish (proxied, but served by Universal — fine for apex/1-level only)"
  elif [[ $proxied -eq 1 && $covers -eq 0 ]]; then
    verdict="PROBLEM (proxied but served cert does NOT cover this host)"
  else
    verdict="GREY (not proxied yet — direct to origin)"
  fi
  [[ "$verdict" == OK* ]] || ((failures++))

  # --- output ---------------------------------------------------------------
  if [[ $MD -eq 1 ]]; then
    printf '| `%s` | %s | %s | %s | %s | %s |\n' \
      "$host" "$dns_label" \
      "$([[ $proxied -eq 1 ]] && echo yes || echo no)" \
      "$issuer_short" \
      "$([[ $covers -eq 1 ]] && echo yes || echo no)" \
      "$verdict"
  else
    echo "================ $host ================"
    echo "  DNS:     $dns_label  [${ips[*]:-none}]"
    echo "  HTTP:    proxied=$([[ $proxied -eq 1 ]] && echo yes || echo no)  server='${server:-?}'  cf-ray='${cfray:-none}'"
    echo "  TLS:     issuer=$issuer_short  sans=${san_count}  covers_host=$([[ $covers -eq 1 ]] && echo yes || echo no)"
    [[ $san_count -gt 0 ]] && echo "           SANs: ${sans[*]}"
    echo "  VERDICT: $verdict"
    echo
  fi
done

exit $(( failures > 255 ? 255 : failures ))
