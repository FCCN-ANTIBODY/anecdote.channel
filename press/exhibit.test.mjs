// Unit: press/exhibit.mjs — the README scheme of library.anecdote.channel/EXHIBIT.md, read from source.
// Run: node press/exhibit.test.mjs
import { exhibitOf, CANON } from "./exhibit.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

// 1. The shape the library's own README has.
{
  const src = "---\npermalink: /\nname: NAME\nagents: AGENTS.md\nopen: OPEN.md\nweather: sunny\n---\n\n# library.anecdote.channel\n\n" +
    "[Adopting](ADOPTING.md) · [Categories](CATEGORIES.md) · [Open](OPEN.md)\n\n**An engine.** With a [link](x.md) in prose.\n";
  const e = exhibitOf(src);
  ok(e.title === "library.anecdote.channel" && e.permalink === "/", "title and permalink");
  ok(JSON.stringify(e.canon) === JSON.stringify([{ key: "name", path: "NAME" }, { key: "agents", path: "AGENTS.md" }, { key: "open", path: "OPEN.md" }]), "canon keys become buttons, in canon order; unknown keys ignored");
  ok(e.strip.length === 3 && e.strip[0].label === "Adopting" && e.strip[2].href === "OPEN.md", "the first link list after the title is the strip");
}

// 2. Prose is never promoted to navigation.
{
  const e = exhibitOf("# thing\n\nRead [this](a.md) and then [that](b.md), in that order.\n\n[A](a.md) · [B](b.md)\n");
  ok(e.strip.length === 0, "a sentence with two links is prose; and a link list AFTER prose is just a list");
  ok(exhibitOf("# thing\n\n[only one](a.md)\n").strip.length === 0, "one link is not a strip");
  ok(exhibitOf("[A](a.md) · [B](b.md)\n\n# late title\n").strip.length === 0, "links before the title are not the strip");
}

// 3. A markdown bullet list of links is a strip too (the same thing, written the other common way).
ok(exhibitOf("# t\n\n- [A](a.md)\n- [B](b.md)\n").strip.length === 2, "a bullet list of nothing but links");

// 4. No front matter, no title, nothing at all: an empty description, never a throw.
{
  const e = exhibitOf("just words");
  ok(e.title === "" && e.canon.length === 0 && e.strip.length === 0 && e.permalink === null, "plain text describes as empty");
  ok(exhibitOf(null).strip.length === 0, "null source is empty");
}

// 5. A canon key may not point out of the bottle.
{
  const e = exhibitOf("---\nconstitution: https://example.com/C.md\nlicense: ../LICENSE\nagents: docs/AGENTS.md\n---\n# x\n");
  ok(JSON.stringify(e.canon) === JSON.stringify([{ key: "agents", path: "docs/AGENTS.md" }]), "absolute and climbing canon paths are dropped");
}
ok(!CANON.includes("readme"), "README is the door, never a button");

if (fails) { console.error(`\n${fails} failed`); process.exit(1); }
console.log("\nexhibit: all passed");
