# Deep-wildcard TLS via Cloudflare ACM

`anecdote.channel` serves deep, 5-part hostnames such as
`moniker.fort-collins.colorado.anecdote.channel`. A TLS wildcard only matches
**one** label (`*.anecdote.channel` does **not** cover `x.y.anecdote.channel`),
and Cloudflare's free Universal SSL only covers the apex plus one level. To cover
deeper names on the **edge** certificate (the one browsers see when the host is
proxied through Cloudflare), the zone uses **Advanced Certificate Manager (ACM)**.

Cloudflare issues and **auto-renews** the ACM certificate. This repo only decides
*which* hostnames it covers, via `config/san-list.txt`. A GitHub Action
(`.github/workflows/acm-sync.yml` → `scripts/reconcile-acm.sh`) reconciles the
Cloudflare advanced certificate pack with that file. **No private keys are ever
generated or stored.**

## Adding a city / region

1. Edit `config/san-list.txt`. Add a wildcard at the level just above the varying
   leaf — e.g. to cover `*.boulder.colorado.anecdote.channel`, add that line.
   Remember the per-level rule:
   - `*.<city>.<state>.anecdote.channel` — for `<leaf>.<city>.<state>...`
   - `*.<state>.anecdote.channel` — for `<city>.<state>...`
   - `*.anecdote.channel` + `anecdote.channel` — already present
2. Open a PR. The Action runs in **dry-run** and shows the planned change.
3. Merge to `main`. The Action orders a new advanced pack with the updated host
   list, waits for it to go `active`, then deletes the superseded pack.

Limit: **50 hosts per pack** (the apex counts). Past ~49 entries the script aborts
rather than truncate — the list must then be sharded across multiple packs, which
requires extending `scripts/reconcile-acm.sh`.

## One-time setup (manual — billing/credentials can't be automated)

1. **Enable ACM** (~$10/mo): Cloudflare dashboard → SSL/TLS → Edge Certificates →
   enable Advanced Certificate Manager.
2. **Create a scoped API token**: My Profile → API Tokens → Create Token (custom).
   Permissions, scoped to the `anecdote.channel` zone:
   - Zone → **SSL and Certificates → Edit**
   - Zone → **Zone → Read**
   (`DNS → Edit` is not needed — Cloudflare places DCV records itself for zones on
   Cloudflare DNS.)
3. **Add repo settings** (Settings → Secrets and variables → Actions):
   - Secret `CLOUDFLARE_API_TOKEN` = the token above
   - Variable `CF_ZONE_ID` = the zone id (Cloudflare dashboard → zone → Overview)
4. **First run**: trigger the workflow manually with `dry_run = true`, confirm the
   planned order, then run again with `dry_run = false`.

## Verifying

- **Plan locally:**
  ```sh
  export CLOUDFLARE_API_TOKEN=...   CF_ZONE_ID=...
  scripts/reconcile-acm.sh --dry-run
  ```
- **In Cloudflare:** `GET /zones/$CF_ZONE_ID/ssl/certificate_packs?status=all`
  shows one `advanced` pack whose `hosts` equal the config.
- **On the wire** (once the host is proxied *and* an origin serves it):
  ```sh
  openssl s_client -connect <host>:443 -servername <host> </dev/null \
    | openssl x509 -noout -text | grep -A1 'Subject Alternative Name'
  ```
  Confirm the matching wildcard SAN is present and the issuer is Let's Encrypt.

## Important caveats

- **This only covers the browser ↔ Cloudflare (edge) certificate.** The hosts must
  be **proxied (orange cloud)** for this cert to be the one browsers see; the zone
  is DNS-only today.
- **Content still has to be served.** The Cloudflare ↔ origin leg needs an origin
  that actually answers for these hostnames. **GitHub Pages serves a single custom
  domain and does not support wildcards**, so it cannot host arbitrary deep
  subdomains — that needs a real origin, a Cloudflare Tunnel, or Workers. Choosing
  and wiring that origin (and a `Full`/`Full (Strict)` encryption mode with a valid
  origin cert) is a separate task from certificate coverage.
