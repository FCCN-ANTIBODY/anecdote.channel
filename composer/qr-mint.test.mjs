// Unit: minting a poll's QR (the "project" face), cross-checked BYTE-FOR-BYTE against the real Tell crypto
// in tell.anecdote.channel — tl_token (tell-lib.sh) for the token and bin/qr for the whole URL. If either
// script isn't present (checked out elsewhere), those oracle cases are skipped, not failed.
// Run: node composer/qr-mint.test.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { mintToken, mintQR, qrCanon, hmacHex, qrMintOps } from "./qr-mint.mjs";
import { elevatedSession, request, FRAME, ERROR } from "./probe-line.mjs";
import { buildPoll } from "../viewer/poll.mjs";
import { parseQR } from "./poll-answer.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const TELL = "/home/user/tell.anecdote.channel";
const LIB = TELL + "/bin/tell-lib.sh", QR = TELL + "/bin/qr";
const haveLib = fs.existsSync(LIB), haveQR = fs.existsSync(QR);
const SECRET = "test-master-secret-do-not-use";

function refToken(secret, pile, poll, round) {
  return execFileSync("bash", ["-c", `. "${LIB}"; tl_token "$1" "$2" "$3" "$4"`, "x", secret, pile, poll, round], { encoding: "utf8" }).trim();
}
function refQR(secret, args) {
  const out = execFileSync("bash", [QR, ...args], { encoding: "utf8",
    env: { ...process.env, TELL_QR_SECRET: secret, TELL_DOMAIN: "https://tell.anecdote.channel", TELL_REPO: "" } });
  return out.split("\n").find((l) => l.startsWith("http")).trim();     // the URL line (notes go to stderr)
}

// 1. mintToken is byte-identical to tell-lib.sh tl_token.
{
  const mine = await mintToken(SECRET, "cd04-q1", "budget", "1");
  ok(/^[0-9a-f]{64}$/.test(mine), "token is 64 lowercase hex chars");
  if (haveLib) ok(mine === refToken(SECRET, "cd04-q1", "budget", "1"), "mintToken === tl_token (the real Tell crypto)");
  else console.log("  skip: tl_token oracle (tell.anecdote.channel not checked out)");
  // token binds {pile,poll,round}: any change diverges
  const other = await mintToken(SECRET, "cd04-q1", "budget", "2");
  ok(mine !== other, "a different round mints a different token (can't be retargeted)");
}

// 2. hmacHex sanity (the primitive) vs openssl directly.
{
  const mine = await hmacHex("k", "m");
  const ref = execFileSync("bash", ["-c", `printf '%s' "$2" | openssl dgst -sha256 -hmac "$1" -r | cut -d' ' -f1`, "x", "k", "m"], { encoding: "utf8" }).trim();
  ok(mine === ref, "hmacHex === openssl HMAC-SHA256 hex");
}

// 3. mintQR assembles a byte-identical URL to bin/qr (unsigned), and it round-trips through parseQR.
{
  const poll = buildPoll({ pile: "cd04-q1", poll: "budget", type: "multichoice", text: "Cut or keep the library budget?",
    options: ["Cut", "Keep"], guidance: "One of the listed options.", tell: "https://tell.anecdote.channel" });
  const { url } = await mintQR(poll, { secret: SECRET, asker: "alice@example.com" });
  ok(url.startsWith("https://tell.anecdote.channel/?pile=cd04-q1&poll=budget&round=1&tok="), "URL leads with the bound fields + token");

  if (haveQR) {
    const ref = refQR(SECRET, ["--pile", "cd04-q1", "--poll", "budget", "--round", "1", "--type", "multichoice",
      "--question", "Cut or keep the library budget?", "--opts", "Cut,Keep", "--guidance", "One of the listed options.",
      "--asker", "alice@example.com"]);
    ok(url === ref, "mintQR URL === bin/qr URL, byte-for-byte");
  } else console.log("  skip: bin/qr oracle (tell.anecdote.channel not checked out)");

  const back = parseQR(url);   // the answer face parses what the project face minted
  ok(back.loaded && back.pile === "cd04-q1" && back.options[1] === "Keep", "a minted QR parses back into the answer view");
  ok(back.tok === (await mintToken(SECRET, "cd04-q1", "budget", "1")), "the parsed token is the minted token (author→mint→answer closes)");
}

// 4. encoding parity on a value with reserved chars (jq @uri encodes !'()* — encodeURIComponent doesn't).
{
  const poll = buildPoll({ pile: "p", poll: "q", text: "Pick one (please)!", options: ["a'b"], type: "open" });
  const { url } = await mintQR(poll, { secret: SECRET });
  ok(url.includes("q=Pick%20one%20%28please%29%21"), "spaces + parens + bang are RFC-3986 encoded like jq @uri");
  ok(url.includes("opts=a%27b"), "apostrophe encoded (not left bare as encodeURIComponent would)");
  if (haveQR) {
    const ref = refQR(SECRET, ["--pile", "p", "--poll", "q", "--round", "1", "--type", "open", "--question", "Pick one (please)!", "--opts", "a'b"]);
    ok(url === ref, "encoding byte-parity holds against bin/qr for reserved chars");
  }
}

// 5. qrCanon: sig/kid/post dropped, sorted (the signing preimage, ready for a later signature).
{
  const canon = qrCanon(["pile=p", "tok=abc", "poll=q", "sig=XX", "kid=YY", "post=ZZ", "round=1"]);
  ok(canon === "pile=p\npoll=q\nround=1\ntok=abc", "qrCanon drops sig/kid/post and sorts by line");
}

// 6. minting requires the secret (can't forge a QR without running the Tell).
{
  let threw = false; try { await mintQR({ pile: "p", poll: "q" }, {}); } catch { threw = true; }
  ok(threw, "mintQR without a secret is refused");
}

// 7. poll.mint over the probe line: Rung 1 (needs confirm), and the secret never crosses to the chamber.
{
  const ops = qrMintOps({ secret: SECRET, domain: "https://tell.anecdote.channel" });
  const poll = buildPoll({ pile: "cd04-q1", poll: "budget", text: "Cut or keep?", options: ["Cut", "Keep"], type: "multichoice" });
  const run = async (confirmed) => { const frames = []; const s = elevatedSession({ ops, emit: (f) => frames.push(f),
      context: () => ({ recordingOn: true, grants: [] }) });
    await s.handle(request({ id: "m", op: "poll.mint", input: { poll }, confirmed })); return frames; };

  const denied = await run(false);
  ok(denied.some((f) => f.type === ERROR && f.needsConfirm), "poll.mint without confirmation is refused (Rung 1)");

  const okd = await run(true);
  const f = okd.find((f) => f.type === FRAME && f.url);
  ok(f && f.url.startsWith("https://tell.anecdote.channel/?pile=cd04-q1"), "confirmed poll.mint returns the QR url");
  ok(f.tok === (await mintToken(SECRET, "cd04-q1", "budget", "1")), "the minted token matches");
  ok(!JSON.stringify(okd).includes(SECRET), "the secret never appears in any frame handed to the chamber");
}

if (fails) { console.error(`\n${fails} FAILED`); process.exit(1); }
console.log("\nall qr-mint tests passed");
