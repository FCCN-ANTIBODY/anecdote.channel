# assets/ds — the anecdote design system, mirrored

The token files, vendored so this origin makes no request off itself. The design system is
**the constellation's**. It was trialled first in a downstream publication; these are the same
tokens, kept as a separable layer rather than folded into this site's stylesheet, so any node
that adopts them can take this directory whole.

Mirror discipline, as with the constellation's other vendored consumer code: **when the source
changes, re-copy verbatim. Do not edit these files here.**

| here | source of truth | |
| --- | --- | --- |
| `colors.css`     | design system `tokens/colors.css`     | byte-identical |
| `spacing.css`    | design system `tokens/spacing.css`    | byte-identical |
| `typography.css` | design system `tokens/typography.css` | byte-identical |
| `fonts.css`      | design system `tokens/fonts.css`      | **deviates — self-hosted, see below** |

## The faces, vendored

| face | file | licence |
| --- | --- | --- |
| Playfair Display Regular | `../fonts/playfair-display.regular.ttf` | the design system's provided master |
| Space Mono Regular / Bold / Italic | `../fonts/SpaceMono-*.woff2` | SIL OFL 1.1 — `SpaceMono-OFL.txt`, carried alongside |

Vendoring a font means carrying its terms, not pointing at where they used to be. Space Mono
Bold Italic is deliberately absent: nothing sets it, and the browser may synthesise it.

## The one deviation, and why it is not optional here

The design system's own `fonts.css` pulls its faces from a third-party font host. This origin
cannot carry that. A webfont fetched from elsewhere tells that elsewhere who is reading, and —
more decisively for *this* repo — **the offline origin must boot with the origin unreachable**.
A face on someone else's CDN is a face that is not there when the network is not. Self-hosting
is the same call the downstream publication made, arrived at from the harder constraint.

## What this site DOES take that the downstream one declines

The display scale. `typography.css` calls it "deliberately enormous" and the downstream
publication refuses it on purpose — prominence expressed typographically is the thing an
editorial page is correcting. **This page is not that page.** It is a directory with almost
nothing on it, and the brand doubles down on the little it puts down. So the wordmark takes
`--display-hero` and its `--shadow-display` signature, which is what the loud version is for.
