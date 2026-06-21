# The map contract (apex / encompassing geographies)

This document defines the interface between a **data-pile** (the producer) and **Anecdote** (the
consumer). It is the same coarse-tier contract used across the `anecdote.channel` constellation,
with the geography element **generalized to a typed region** so Anecdote can reflect *encompassing*
hierarchies — county, major election districts, climate zone, watershed — rather than a single
city-level district.

It is a strict superset of Atlas's `district`-based contract: Anecdote also accepts an Atlas-style
`<district>` element and treats it as a region of type `district`, so any constellation map
reflects here without changes.

## The published map (`map.xml` + `map.xsl`)

Each pile publishes one small XML document per poll, with a linked XSL stylesheet so the raw file
renders human-readably when opened directly — the intentional "map".

```xml
<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="map.xsl"?>
<map poll-id="larimer-q1" updated-at="2026-06-21T00:00:00Z" version="1">
  <region type="county" id="larimer" name="Larimer County, Colorado"/>
  <question>Should the county prioritize watershed restoration in its next capital plan?</question>
  <options>
    <option id="a" label="Yes, make it a top priority"><tier>high</tier></option>
    <option id="b" label="No, keep current priorities"><tier>low</tier></option>
    <option id="c" label="Only alongside wildfire mitigation"><tier>med</tier></option>
  </options>
  <totals accepted="1842"/>
  <rejected geo="74" sig="11" malformed="6" other="19"/>
  <sampling low="b" mid="c" high="a"/>
</map>
```

### Fields

| Node / attribute | Meaning | Source in the sink |
| --- | --- | --- |
| `map/@poll-id` | Stable poll identifier | `answers.json` `poll_id` |
| `map/@updated-at` | ISO-8601 snapshot time | `answers.json` `updated_at` |
| `map/@version` | Schema version (`1`) | constant |
| `region/@type` | Geography level: `county` / `district` / `climate-zone` / `watershed` | poll manifest |
| `region/@id`, `@name` | Public region label | poll manifest |
| `question` | Question text | poll manifest |
| `option/@id`, `@label` | Public option labels | poll manifest |
| `option/tier` | `low` / `med` / `high` | `answers.json` `counts_coarse{}` |
| `totals/@accepted` | Accepted response count | `answers.json` `total_accepted` |
| `rejected/@*` | Rejection tallies | `answers.json` `rejected{}` |
| `sampling/@low\|mid\|high` | Sampled option ids per tier | `answers.json` `sampling{}` |

**Raw per-option vote counts are intentionally never published** — only coarse tiers — to keep
the anti-popularity design intact.

> **Compatibility.** A map may instead carry `<district id="…" name="…"/>` (the Atlas form);
> Anecdote normalizes it to `region` with `type="district"`.

## Required producer-side changes (not in this repo)

To satisfy this contract a pile's sink needs to:

1. **Emit the map.** Render `map.xml` (+ a committed `map.xsl`) from `answers.json` and the poll
   manifest, published at a stable public URL, using `<region type="…">` for the geography.
2. **Cadence ~10 min.** Schedule the rollup toward `*/10 * * * *` (Actions cron is best-effort and
   may drift).
3. **Notify Anecdote.** After publishing, `POST` a `repository_dispatch` to this connector:

   ```sh
   curl -sS -X POST \
     -H "Authorization: Bearer $ANECDOTE_DISPATCH_TOKEN" \
     -H "Accept: application/vnd.github+json" \
     https://api.github.com/repos/fccn-antibody/anecdote.channel/dispatches \
     -d '{"event_type":"pile-updated","client_payload":{"poll_id":"larimer-q1"}}'
   ```

   `ANECDOTE_DISPATCH_TOKEN` is the **sink's** secret (a token with permission to dispatch to this
   connector). Anecdote holds no secret for public piles.

## Consumer side (this repo)

Anecdote reflects any map matching this schema via `_plugins/anecdote_reflection.rb`, driven by
`_data/piles.yml`. Adding a pile is just a registry entry pointing `url:` at its published map.
