# anecdote.channel

**Anecdote** is the apex of the `*.anecdote.channel` constellation — a *reflection API* (a static
data browser) that reflects moderated snapshots ("maps") published by data-piles.

Where the city-level civic nodes (e.g. [`atlas.anecdote.channel`](https://atlas.anecdote.channel))
reflect their own jurisdiction, **Anecdote reflects the *encompassing* physical-space hierarchies**
that contain them — county, major election districts, climate zone, watershed, and up. By
convention the repo name is the DNS name served via GitHub Pages custom domain; Anecdote holds the
**apex** (`anecdote.channel`). Cloudflare will later front it for caching-header control.

## How data flows

```
 respondents ──▶ private sink issue ──▶ rollup (with sink token, ~10 min)
                 (moderation isolation)        │
                                               ▼
                                  public XML+XSL map  (the contract artifact)
                                               │  repository_dispatch: pile-updated
                                               ▼
                                 Anecdote rebuild ──▶ GitHub Pages (this site)
```

- **Private sink, public artifacts.** Raw answers never leave the pile's private sink. The
  rollup emits only a small, deliberately *coarse* public map (tiers, not raw counts), so Anecdote
  only ever sees approved, low-bandwidth output. **Anecdote needs no read token.**
- **The map is the contract.** A self-describing XML document with a linked XSL stylesheet (so
  opening it raw in a browser renders human-readable). See [`CONTRACT.md`](CONTRACT.md).
- **10-minute trickle.** After each rollup the sink fires a cross-repo `repository_dispatch`
  (`event_type: pile-updated`) to this repo, which rebuilds and redeploys.

> For now every reflected pile is produced by the same data-pile location. As state-level data
> begins to vary, additional piles register here and each notifies this repo on its own cadence.

## This repo

Custom GitHub Pages build (we run our own `jekyll build` in Actions) so we control the Jekyll
version and may add any plugins — including the reflection generator in
[`_plugins/anecdote_reflection.rb`](_plugins/anecdote_reflection.rb).

| Path | Purpose |
| --- | --- |
| `_data/piles.yml` | Registry of piles to reflect (`url:` and/or `fixture:`) |
| `_plugins/anecdote_reflection.rb` | Fetches + parses each map into pages |
| `_fixtures/` | Sample map (`larimer-map.xml` + `map.xsl`) for offline builds |
| `_layouts/`, `index.md`, `assets/` | The browser |
| `.github/workflows/deploy.yml` | Build + deploy, triggered by push / dispatch / pile-updated |

## Register a pile

Add an entry to `_data/piles.yml`:

```yaml
- id: my-region-poll
  name: "Human-readable name"
  url: "https://raw.githubusercontent.com/owner/pile/main/parts/poll/map.xml"
  fixture: "_fixtures/larimer-map.xml"   # optional offline fallback
```

`url` is fetched first; `fixture` is used if the fetch fails or no URL is set. The map's
`<region type="…">` (county / district / climate-zone / watershed) groups the pile on the index;
an Atlas-style `<district>` element is also accepted. See [`CONTRACT.md`](CONTRACT.md).

## Develop

```sh
bundle install
bin/jekyll serve             # http://127.0.0.1:4000
```

Builds work offline against the committed fixture, so no live sink is required.

## Operations (one-time)

- Set **Settings → Pages → Source** to **GitHub Actions**.
- Point apex DNS for `anecdote.channel` at GitHub Pages and set it as the custom domain (the
  `CNAME` file is already committed). The full constellation DNS plan, including this apex, lives
  in [`atlas.anecdote.channel/DNS.md`](https://github.com/FCCN-ANTIBODY/atlas.anecdote.channel/blob/main/DNS.md).
- For private-artifact piles only: add an `ANECDOTE_PILE_TOKEN` secret (a protected environment
  is recommended). Public piles need nothing.
