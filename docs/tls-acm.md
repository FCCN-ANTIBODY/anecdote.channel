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

- **Quick edge check (per host):** `scripts/check-edge.sh <host>` runs the DNS,
  header, and certificate checks below and prints an `OK` / `GREY` / `PROBLEM`
  verdict. Add `--md` for a Markdown table to paste into a report. Run it from a
  normal network — TLS-intercepting networks distort the cert read.
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

## Onboarding a node (GitHub Pages + Cloudflare)

Each node is **its own GitHub Pages site with its own DNS record**. One repo can't
answer every deep hostname, so the content per node lives in that node's repo; the
ACM wildcard cert covers them all at the edge. Per node:

1. **Create the node's GitHub Pages repo** and, in its Pages settings, set the
   **custom domain** to the full hostname, e.g.
   `moniker.fort-collins.colorado.anecdote.channel`. (A GitHub Pages site allows one
   custom domain, unique across GitHub — hence one site per node.)
2. **Add a DNS record in Cloudflare** for that hostname → `CNAME` to
   `<user>.github.io`, and leave it **DNS-only (grey cloud)** for now.
3. **Let GitHub Pages provision its cert.** With the record grey, GitHub validates
   the domain and issues the origin Let's Encrypt cert; then tick **Enforce HTTPS**
   in the repo's Pages settings.
4. **Flip the record to proxied (orange cloud).** Now the **ACM edge cert** is what
   browsers see (matched by the wildcard SAN), and Cloudflare proxies to the Pages
   origin.

> **Order matters:** GitHub Pages cannot provision its origin cert while the record
> is proxied — it can't see the real DNS. Always grey → provision → orange.

### Encryption mode: use **Full**, not Full (Strict)

Keep SSL/TLS → Overview on **Full** (the `Automatic` setting already resolves to
Full). Reasons:

- **Full (Strict)** validates the origin cert, and GitHub Pages' origin-cert renewal
  *fails while proxied* — that would take nodes down roughly every 3 months.
- **Full** still encrypts Cloudflare ↔ origin but doesn't hard-fail on origin-cert
  issues, so a stalled Pages renewal won't break the site. Public-facing security
  comes from the **ACM edge cert** regardless.
- **Never Flexible** — it causes infinite redirect loops with GitHub Pages.

### When does the certificate list change?

- **New node in an existing city** → just add the DNS record. **No `san-list.txt`
  change** — `*.<city>.<state>.anecdote.channel` already covers every leaf there.
- **First node in a new city or state** → add the one matching wildcard line to
  `config/san-list.txt` (see "Adding a city / region" above) and let the Action
  reconcile.
- A new node by itself **never** touches the certificate.

## Important caveats

- **This only covers the browser ↔ Cloudflare (edge) certificate.** The hosts must
  be **proxied (orange cloud)** for this cert to be the one browsers see; the zone
  is DNS-only today.
- **Content still has to be served per node.** The Cloudflare ↔ origin leg needs an
  origin that answers for each hostname — here, one GitHub Pages site per node (see
  "Onboarding a node" above). The edge cert does not serve content.
