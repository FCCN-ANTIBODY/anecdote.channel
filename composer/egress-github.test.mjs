// Tests for GitHub egress (serialize a delivery into an issue/comment and post it).
// Dependency-free, deterministic; the HTTP seam is faked — no network, no real credential.
//   node composer/egress-github.test.mjs
import { memoryStore } from "../reducer/store.mjs";
import { prepare } from "./route.mjs";
import { build } from "./anecdote.mjs";
import { generateIdentity, sign } from "./sign.mjs";
import { mintNonce } from "./consent.mjs";
import { submissionBlock, submissionBody, labelsFor, request, post, interpretStatus, SUBMISSION } from "./egress-github.mjs";

let fails = 0;
const ok = (c, m) => { if (!c) { console.error("FAIL: " + m); fails++; } else console.log("  ok: " + m); };

const agent = { instrument: "minilm:sha256:deadbeef", constitution: "anecdote:sha256:cafe" };
const tell = { kind: "tell", id: "neighbors", url: "https://nbhd.example", excludes: [] };
const CREDENTIAL = "ghs_SUPER_SECRET_post_token";

async function aDelivery() {
  const routed = prepare("The park needs more shade", tell, {});
  const a = await build(routed);
  const signed = await sign(a, await generateIdentity(), { agent, nonce: mintNonce() });
  // shape of tunnel outTheDoor for a Tell:
  return { kind: "tell-issue", to: { id: "neighbors", kind: "tell", url: "https://nbhd.example" },
    poll: { pile: "cd04-q1", poll: "budget", round: 1, asker: "city", question: "How should we spend it?" },
    token: "HMAC-tok-abc", anecdote: signed };
}

// 1. The fenced block is Tell-parser-compatible AND carries the new fields — and NO credential.
{
  const d = await aDelivery();
  const block = submissionBlock(d, { run: "run-7" });
  ok(block.schema === SUBMISSION, "block is tell.submission/v1");
  ok(block.pile === "cd04-q1" && block.poll === "budget" && block.round === "1" && block.tok === "HMAC-tok-abc",
    "block carries pile/poll/round/tok the Tell's authz needs");
  ok(block.answer === "The park needs more shade", "answer is the verbatim statement (string, as the Tell reads)");
  ok(block.nonce && block.nonce === d.anecdote.nonce, "block carries the consent nonce (revocation linkage)");
  ok(block.run === "run-7", "block carries the run id (tell runs apart)");
  ok(block.anecdote && block.anecdote.sig, "block carries the full signed anecdote");
  const body = submissionBody(d, { run: "run-7" });
  ok(!body.includes(CREDENTIAL), "the post credential never appears in the serialized body");
  ok(/```tell[\s\S]*```/.test(body) && body.startsWith("The park needs more shade"), "body is raw answer + fenced block");
}

// 2. request(): comment mode targets the canonical issue; issue mode gets a title + labels.
{
  const d = await aDelivery();
  const cm = request(d, { repo: { owner: "FCCN-ANTIBODY", name: "tell.anecdote.channel" }, mode: "comment", canonicalIssue: 42, run: "r1" });
  ok(cm.method === "POST" && cm.path === "/repos/FCCN-ANTIBODY/tell.anecdote.channel/issues/42/comments",
    "comment mode posts onto the canonical poll issue");
  ok(cm.payload.body && cm.payload.labels === undefined, "a comment has a body and no labels");

  const is = request(d, { repo: { owner: "FCCN-ANTIBODY", name: "tell.anecdote.channel" }, mode: "issue", run: "r1" });
  ok(is.path === "/repos/FCCN-ANTIBODY/tell.anecdote.channel/issues", "issue mode posts a new issue");
  ok(is.payload.title === "How should we spend it?", "issue title is the poll question");
  ok(is.payload.labels.includes("via:anecdote") && is.payload.labels.includes("poll:budget") && is.payload.labels.includes("run:r1"),
    "issue labels carry poll/run metadata for human filtering");
}

// 3. post(): uses the credential only in the api call, returns a placement that omits it.
{
  const d = await aDelivery();
  let seen = null;
  const api = async (call) => { seen = call; return { status: 201, json: { id: 999, html_url: "https://github.com/x/y/issues/42#issuecomment-999" } }; };
  const { placement, delivery } = await post(d, { repo: { owner: "x", name: "y" }, mode: "comment", canonicalIssue: 42, run: "r1", credential: CREDENTIAL, api });
  ok(seen.token === CREDENTIAL, "the credential is handed to the api (Authorization), nowhere else");
  ok(!JSON.stringify(seen.body).includes(CREDENTIAL), "the credential is not in the posted body");
  ok(placement.url.endsWith("#issuecomment-999") && placement.id === 999 && placement.issue === 42 && placement.run === "r1",
    "placement records where it landed");
  ok(JSON.stringify(placement).indexOf(CREDENTIAL) === -1, "the credential is NOT in the placement (never stored)");
  ok(delivery.state === "pending", "delivery starts pending — acceptance is async");
}

// 4. post() surfaces a failure instead of swallowing it (the promise: you will know).
{
  const d = await aDelivery();
  const api = async () => ({ status: 403, json: { message: "Resource not accessible" } });
  let threw = false;
  try { await post(d, { repo: { owner: "x", name: "y" }, mode: "issue", credential: CREDENTIAL, api }); } catch (e) { threw = /403/.test(e.message); }
  ok(threw, "a non-2xx GitHub response throws (caller records it, never silent)");
}

// 5. interpretStatus(): how acceptance resolves later, per mode.
{
  ok(interpretStatus({ labels: [{ name: "ingested" }], state: "closed" }, { mode: "issue" }).state === "accepted", "an ingested issue is accepted");
  ok(interpretStatus({ labels: ["rejected:spam"], state: "closed" }, { mode: "issue" }).reason === "spam", "a rejected issue carries its reason");
  ok(interpretStatus({ labels: [], state: "open" }, { mode: "issue" }).state === "pending", "an open, unlabeled issue is pending");
  ok(interpretStatus({ reactions: { "-1": 1 } }, { mode: "comment" }).state === "rejected", "a 👎 reaction rejects a comment");
  ok(interpretStatus({ reactions: { "+1": 2 } }, { mode: "comment" }).state === "accepted", "a 👍 reaction accepts a comment");
}

console.log(fails ? `\n${fails} FAILED` : "\nall passed");
process.exit(fails ? 1 : 0);
