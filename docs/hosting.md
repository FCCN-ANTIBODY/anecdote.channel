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

## Credentials — one token, one job, and the name says which

**`CLOUDFLARE_API_TOKEN` is not an allowed name here.** A Cloudflare API token cannot be scoped to a
single Pages project, so the only scoping actually available is the *name*: each token is minted for
one job, named for that job, and used by nothing else. A name that says only "Cloudflare" tells you
nothing about what it governs, and a drawer of those is unauditable.

All of these are **organisation** secrets, scoped to the `anecdote.channel` zone.

| name | permission | used by |
| --- | --- | --- |
| `CLOUDFLARE_PAGES_TOKEN` | Account → Cloudflare Pages → Edit | deploying this site |
| `CLOUDFLARE_ACCOUNT_ID` | (not a token — the account id) | deploying this site |
| `CLOUDFLARE_ACM_TOKEN` | Zone → SSL and Certificates → Edit | `acm-sync.yml` |
| `CLOUDFLARE_CACHE_TOKEN` | Zone → Cache Purge | `scripts/cf-purge.sh`, if anything ever fronts this again |
| `CLOUDFLARE_RULES_TOKEN` | Account → Rules Lists → Edit | `scripts/reconcile-redirects.sh` |

Plus one repository **variable**, `CLOUDFLARE_PAGES_PROJECT` (`anecdote`), because the project name
is not a credential and does differ per repository.

**They are organisation secrets on purpose, and that is a concession rather than a preference.**
Scoping a token to one project is impossible at Cloudflare, so a repository copy would be the same
blast radius with more places to forget it. One definition, one place to rotate it.

**Never give two of these the same name.** A repository secret silently SHADOWS an organisation
secret of the same name, so a deploy token at the org and a certificate token at the repo, both
called `CLOUDFLARE_API_TOKEN`, hands the certificate token to the deploy and fails with an
authentication error naming neither. That has already happened here twice — once with a zone id
under two names, once with a token doing two jobs.

## History

This was published by a GitHub Actions workflow to GitHub Pages, fronted by Cloudflare as a cache.
That arrangement is retired: the Pages site is unpublished and the workflow is removed. Two things
went with it, both deliberately:

- **The Cloudflare cache purge.** It existed only because Cloudflare sat in front of a different
  origin. When Cloudflare *is* the origin there is no upstream cache to invalidate, and the whole
  question of purge tokens and their permissions goes away with it.
- **`.nojekyll`.** It told GitHub Pages not to run Jekyll over the tree. Nothing else ever read it.
