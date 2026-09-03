# Hosting this site

The site is **served as committed** — no Jekyll, no bundler, no output directory. `index.html`
interprets itself in the browser. That is the whole design (see the note in `index.html`: *"you can
publish shitty source files and get a website with no build"*).

There is exactly one thing that is *not* in the repository and has to be produced at publish time.

## `sites.json` is generated, never committed

`scripts/sync-sites.mjs` writes `/sites.json`, and `.gitignore` deliberately excludes it. The front
page fetches it at runtime and, if the fetch fails, falls back to the standing-by message with **no
directory at all**. That failure is silent and looks like missing content rather than a missing
build step — it has happened before, which is why `scripts/page.test.mjs` exists.

**So any host must run the build command.** Serving the repository as-is publishes a site whose
front page is empty.

```
build command      node scripts/sync-sites.mjs
output directory   .          (the repository root — there is no build output)
```

The script also **fails** when a host listed in `config/sites.txt` has no TLS coverage in
`config/san-list.txt`. That is a feature: a failed build is the guard that stops a name being
published before its certificate exists. A host that ignores build failures loses that guard.

## The one environment variable

`config/sites.txt` contains `repo:` entries, which are resolved through the GitHub API. Unauthenticated
that is 60 requests an hour, and **a rate-limited lookup reads exactly like a site that is not
there** — the entry silently disappears from the directory rather than erroring.

```
GITHUB_TOKEN (or GH_TOKEN)   any token with public read is enough
SITES_TOKEN_<OWNER>          per-owner override, for a private repo
```

On GitHub Actions this came free as `github.token`. Anywhere else it has to be supplied.

## Credentials, and why there are two Cloudflare tokens

**One token, one job.** They are deliberately not merged, and they are deliberately scoped
differently, because they answer to different things.

| name | scope | permission | used by |
| --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | **org** secret | Account → Cloudflare Pages → Edit | deploying this site |
| `CLOUDFLARE_ACCOUNT_ID` | **org** secret | (not a token — the account id) | deploying this site |
| `CLOUDFLARE_ACM_TOKEN` | **repo** secret | Zone → SSL and Certificates → Edit | `acm-sync.yml` only |
| `CLOUDFLARE_PAGES_PROJECT` | **repo** variable | `anecdote` | deploying this site |
| `CLOUDFLARE_ZONE_ID` | variable | (not a token) | `acm-sync.yml` only |

Publishing is a thing every site in the account does the same way, so its credential belongs to the
account. Reconciling *this zone's* certificate is peculiar to this repository, so its credential
belongs here — which is also the smaller blast radius: a leaked deploy token publishes a site, a
leaked certificate token can reissue TLS.

**They must not share a name.** A repository secret silently SHADOWS an organisation secret of the
same name, so one called `CLOUDFLARE_API_TOKEN` in both places would hand the SSL token to the
deploy and fail with an authentication error that names neither. That has already happened once here
with a zone id under two names; this is the same failure wearing a different hat.

## History

This was published by a GitHub Actions workflow to GitHub Pages, fronted by Cloudflare as a cache.
That arrangement is retired: the Pages site is unpublished and the workflow is removed. Two things
went with it, both deliberately:

- **The Cloudflare cache purge.** It existed only because Cloudflare sat in front of a different
  origin. When Cloudflare *is* the origin there is no upstream cache to invalidate, and the whole
  question of purge tokens and their permissions goes away with it.
- **`.nojekyll`.** It told GitHub Pages not to run Jekyll over the tree. Nothing else ever read it.
