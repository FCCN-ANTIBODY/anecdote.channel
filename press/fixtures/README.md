# press/fixtures

Bottles for the press to open when nothing real is beside it — in CI, in the real-Chromium suite, and on a
checkout that has no thawed siblings. `scripts/serve-constellation.mjs` shelves each directory under
`shelf/` at `<label>.library.<apex>`; `probe-test/press.ui.test.mjs` does the same on the true hostnames.

Each one is a rung of the face ladder (`press/face.mjs`), and is small on purpose:

| label | what it is | which rung answers |
| --- | --- | --- |
| `field-guide` | a component bottle written to `library.anecdote.channel/EXHIBIT.md`: canon in the front matter, a strip under the title | `README.md`, shown as the index |
| `hello-code` | a code bottle that wrote a front page on purpose | `index.md` wins over `README.md` |
| `unbuilt` | Jekyll source nobody built — no README, no `index.md` | `index.html`, rendered from source by `jekyll-enough`, with one include deliberately missing |

They are fixtures. Nothing in them is a claim about a real place.
