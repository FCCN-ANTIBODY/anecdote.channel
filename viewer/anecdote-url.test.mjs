// Tests for the anecdote:// local URL scheme. Run: node viewer/anecdote-url.test.mjs
import { anecdoteUrl, parseAnecdoteUrl, isAnecdoteUrl, isWebUrl } from "./anecdote-url.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

ok(anecdoteUrl("repo", "my-session") === "anecdote://repo/my-session", "basic repo url");
ok(anecdoteUrl("repo", "my session") === "anecdote://repo/my%20session", "labels are encoded");
ok(anecdoteUrl("pile.poll", "budget/2026") === "anecdote://pile.poll/budget%2F2026", "slashes in id are encoded");

const p = parseAnecdoteUrl("anecdote://repo/my%20session");
ok(p && p.kind === "repo" && p.id === "my session", "parse round-trips kind + decoded id");
ok(parseAnecdoteUrl("https://github.com/x/y") === null, "a web url does not parse as anecdote://");

ok(isAnecdoteUrl("anecdote://repo/x") && !isAnecdoteUrl("https://x"), "isAnecdoteUrl distinguishes local");
ok(isWebUrl("https://github.com/x") && !isWebUrl("anecdote://repo/x"), "isWebUrl distinguishes resolvable-web");

// the round-trip property for arbitrary labels
for (const label of ["a b", "poll/2026", "keys:v1", "emoji✓", "with?q=1#h"]) {
  const back = parseAnecdoteUrl(anecdoteUrl("repo", label));
  ok(back && back.id === label, `round-trip preserves ${JSON.stringify(label)}`);
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall anecdote-url tests passed");
