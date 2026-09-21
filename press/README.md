# press/ — the total experience, several ways

**One page that feels like one place. Under it, every view is an iframe onto some other origin in the
subdomain world.** The demo shelf in `AGENTS.md` proves capabilities one at a time; this directory is what
they are *for*, composed — and it adds no mechanism of its own. If something here looks new, it is an
arrangement of `composer/`, `git-enough/`, `jekyll-enough/` and the probe line.

    node scripts/serve-constellation.mjs        # the subdomain world on one port
    open http://anecdote.localhost:8137/press/

Browsers resolve every `*.localhost` name to loopback on their own, and each hostname is a real origin with
its own storage. The server shelves any sibling checkout it finds beside this one (a thawed group) at
`<label>.library.anecdote.localhost`, serves them **as committed — no build**, and lays a floor under every
other name. With no siblings, `press/fixtures/shelf/` is what there is to read.

## Two gestures and a verb

| | what happens | built from |
| --- | --- | --- |
| **go** | A place is shown **on ice** — its source fetched, its *face* resolved, read in a sterile `data:` chamber — or **live**, the origin itself in a frame. | `face.mjs`, `chamber.mjs`, `composer/probe-line.mjs` |
| **write** | A statement, with an object attached, is signed here and printed into a pile here, as a commit. Said *over* a page, it carries a receipt for the **version** it was said over — by hash, copying none of it. | `bench.mjs`, `pile.mjs`, `composer/{route,anecdote,sign,transfer}.mjs`, `git-enough/repo.mjs` |
| **read** | A floor **on another origin** holds the lens; the press drinks its frames, heals around damage, verifies, opens what arrived sterile — and writes nothing until you say *slap it down*. | `catch.mjs`, `composer/{carrier,fountain,transfer,bottle-embed}.mjs` |

### The face of a bottle

A repository is source files, and most say what they are in a README. `face.mjs` reads one the way a person
would, and stops at the first rung that answers:

1. **`index.md`** — it wrote a front page on purpose. It wins.
2. **`README.md`** — shown *as if it were the index*. With the front matter and strip of
   `library.anecdote.channel/EXHIBIT.md`, `exhibit.mjs` draws the canon as buttons and the strip as tabs.
3. **`index.html` with a fence** — unbuilt Jekyll, rendered here by `jekyll-enough` in its lenient posture.
4. **live** — only a *built* page answered: a running site's face is itself, so it is framed.
5. **none** — and "this name did not answer" is said differently from "nothing here yet", because they are
   different facts about somebody's place.

**The tree is lazy and the renderer is what asks for it.** Nobody can list a directory over HTTP, and
`buildSite` wants a whole tree. It gets the page; its lenient build *names what it lacks* (a gap per missing
include, a throw per missing layout), each round fetches exactly that, and what is still missing at the end
is printed at the foot of the face. The renderer's own complaint is the fetch list — no second parser.

`markdown-enough` has no lists, tables or blockquotes on purpose, and its `AGENTS.md` refuses widening it.
`markdown-more.mjs` does not widen it: it upgrades those blocks to HTML *in front of it*, because the enough
renderer passes raw HTML blocks through verbatim, and `buildSite` takes the doc renderer as a plug.

### The reading room

D15: *viewing a bottle is always the sterile experience.* The chamber's policy is `default-src 'none'`; its
one script runs under a per-render nonce, so whatever `<script>` a bottle carried is inert markup beside it.
That script does one thing — a pressed link **asks** `press.follow` down the probe line. Where it leads is
decided out here, in these pixels: another pane, another place, or *"this leaves anecdote.channel"*, which
is announced and never followed. Styles match **by construction, not inheritance**
(`docs/intermediates.md`): the tokens and two faces are inlined as text and `data:` URLs.

## The four skins

They are one engine and one stylesheet; each is a layout and a sentence. They exist to be stood in, one
after another, and compared by feel.

| | the idea it takes literally |
| --- | --- |
| [`halt.html`](halt.html) | `docs/single-attention.md`: you arrive at **nothing**, and it says so. One line is the whole interface — a statement, an `@place`, a `~pile`. Arriving fetches from no other origin. |
| [`bench.html`](bench.html) | *"an anecdote printing press to our own piles"*: **bed · sheet · rack**, three panes you swipe between on a phone. |
| [`counter.html`](counter.html) | D14/D17: two people, present. **Hand over** / **Take**, half a screen each. Keeps no view between visits. |
| [`overlay.html`](overlay.html) | The petition *posting-from-a-phone*: *"a button that drops into posting mode over whatever is already rendering."* |

Piles are shared across skins (one origin, one store), so a sheet printed in one is on the rack in another.

## The broadcast target, and the three ways to cut a bottle up

[`broadcast.html`](broadcast.html) is not a skin. It is **a page that does nothing but broadcast** — the
thing you point the *other* phone at, so that two phones produce numbers instead of impressions. Take a file
or make one, pick how it is cut, press full screen. [`broadcast.mjs`](broadcast.mjs) is the pure half.

| profile | | cut |
| --- | --- | --- |
| **still** | one code, one glance — no loop, no playhead, while it fits (≈2 KB at level L) | **droplets** — rateless; any sufficient subset rebuilds it, so a miss costs nothing |
| **collage** | n codes at once: redundancy in **space** | **blocks** — a fixed set, each needed once; no overhead at all, but a miss waits for the loop |
| **stream** | one at a time, endless: redundancy in **time** | |

Every plan reports a **floor** — the fewest screen-reads a perfect camera would need. Everything else on the
page is arithmetic; the one number that is not is what the second phone tells you. See
[`../docs/preview-paradigm.md`](../docs/preview-paradigm.md) for the measured baselines and the two-phone
procedure.

## What it refuses, because `docs/decisions.md` already did

- **No daisy chains (D8).** Nothing a framed page asks is forwarded to the keeper, or anywhere.
- **The shelf is never enumerable (D11).** The rack is this origin reading its own book; no op exposes it.
- **No trail (D7).** One remembered view per skin, one slot, no `persist()`. *Stop* forgets, leaving no key.
- **By reference, never by copy.** A statement *about* a page keeps a hash of it and none of its bytes.
- **Live text binds.** A `CONSTITUTION.md` read on ice was fetched a moment ago, and is cached nowhere.

## What is a stand-in, said plainly

- **`press/floor/`** is not the library's floor. It is a doorway to stand in front of until the library lays
  one with the bottles driver mounted (D18). It imports its reader from the apex at runtime; a real floor
  carries its own and fetches nothing.
- **The signing key is minted per session.** The real press asks the keeper, behind a passkey gesture
  (`composer/gesture.mjs`, D8/D12). Every skin that signs says so on its face.
- **A recording is a text file of frames.** The stored and enchanted renderings are the driver's
  (`bottles.anecdote.channel/README.md`); only the *projected* one is drawn here, because a camera reads it.
- **Foreign Liquid is rendered.** It has no I/O and lands in a chamber with no network, so the hazard is
  time, not reach; the budget in `face.mjs` caps rounds and files, not template work. The journal engine's
  rule — *a contributor does not get to run a step in the newsroom's build* — is about a build with
  authority. This one has none. Worth a second opinion before it is anything but a demo.

## Tests

`node scripts/test.mjs` runs the eight Node suites here. `probe-test/press.ui.test.mjs` runs the whole
composition in real Chromium on the true hostnames — including a bottle caught across origins through
deliberately damaged frames — and self-skips where there is no browser.
