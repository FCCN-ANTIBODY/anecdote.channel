// press/chamber.mjs — THE READING ROOM: the document a face is set in before it is shown.
//
// D15: "Viewing a bottle is always the sterile experience." A face is somebody else's bytes, so it is read
// in a `data:` chamber (composer/probe-line.mjs spawnChamber): no origin, no storage, no network, no keys.
// This module builds that chamber's document. It is a string builder and nothing else — pure, so every
// promise below is checked by a test that never opens a browser.
//
// WHAT THE CHAMBER MAY DO, AND THE ONE THING IT MAY ASK.
//   - Its Content-Security-Policy is `default-src 'none'`. Styles are inline, images and fonts only `data:`,
//     and SCRIPT runs only under a per-render nonce — so the one script in the room is ours, and whatever
//     <script> a bottle carried is inert markup. Bottles hold anything; we treat all of it as not-code.
//   - Ours does one thing: when a link is pressed it ASKS, down the probe line, `press.follow {href}`. The
//     chamber goes nowhere itself. Where a link leads — another path in this bottle, another bottle, or out
//     of the constellation entirely — is the Elevated press's decision, made where the person can see it.
//
// STYLES MATCH BY CONSTRUCTION, NOT INHERITANCE (docs/intermediates.md). CSS does not cross an origin
// boundary, and a data: chamber has no origin to cross from, so the design tokens are passed in as text and
// inlined. The faces arrive as `data:` URLs or not at all; without them the token stacks fall back to
// Georgia and Courier, which is the design system's own stated fallback.

const esc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const FOLLOW_OP = "press.follow";

export function csp(nonce) {
  return "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; script-src 'nonce-" + nonce + "'; base-uri 'none'; form-action 'none'";
}

// The room's one script. Written as a function body string so it can be set under the nonce.
function forwarder() {
  return `(function(){var port=null,n=0;
addEventListener("message",function(e){if(port||!e.data||e.data.type!=="probe.line.init/v1"||!e.ports||!e.ports[0])return;port=e.ports[0];port.start&&port.start();});
document.addEventListener("click",function(e){var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;if(!a)return;
var h=a.getAttribute("href")||"";if(h.charAt(0)==="#")return;e.preventDefault();
if(port)port.postMessage({type:"probe.line.request/v1",id:"f"+(++n),op:"${FOLLOW_OP}",input:{href:h,text:(a.textContent||"").slice(0,200)}});},true);
if(window.parent!==window)window.parent.postMessage({type:"probe.line.ready/v1"},"*");})();`;
}

function fontFaces(fonts = {}) {
  let css = "";
  if (fonts.display) css += `@font-face{font-family:'Playfair Display';font-weight:400;src:url(${fonts.display})}`;
  if (fonts.mono) css += `@font-face{font-family:'Space Mono';font-weight:400;src:url(${fonts.mono})}`;
  return css;
}

// The reading page's own use of the tokens. Two voices, as everywhere: the display serif says the loud
// thing (headings), the mono says the small true thing (everything else).
const READING = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;padding:var(--space-6,32px) var(--space-5,24px) var(--space-9,96px);background:var(--paper,#fff);color:var(--text-body,#2b2b2b);
  font-family:var(--font-mono,'Courier New',monospace);font-size:var(--mono-body,1rem);line-height:var(--leading-body,1.55)}
main{max-width:var(--measure,64ch);margin:0 auto}
h1,h2,h3{font-family:var(--font-display,Georgia,serif);font-weight:var(--weight-display,400);color:var(--text-strong,#0a0a0a);line-height:var(--leading-snug,1.18);letter-spacing:var(--tracking-display,-.01em)}
h1{font-size:var(--display-2,2.4rem);margin:0 0 var(--space-5,24px)}h2{font-size:var(--display-3,1.7rem);margin:var(--space-7,48px) 0 var(--space-4,16px);padding-top:var(--space-4,16px);border-top:var(--rule,2px) solid var(--border,#0a0a0a)}
h3{font-size:1.3rem;margin:var(--space-6,32px) 0 var(--space-3,12px)}h4,h5,h6{font-size:var(--mono-body,1rem);text-transform:uppercase;letter-spacing:var(--tracking-caps,.16em);margin:var(--space-5,24px) 0 var(--space-2,8px)}
a{color:var(--text-strong,#0a0a0a);text-underline-offset:3px;text-decoration-thickness:1px}a:hover{text-decoration-thickness:var(--rule,2px)}
code{font-family:inherit;background:var(--paper-edge,#eceae6);padding:0 .25em;border-radius:var(--radius-sm,3px)}
pre{background:var(--paper-edge,#eceae6);padding:var(--space-4,16px);overflow:auto;font-size:var(--mono-small,.8125rem);border-radius:var(--radius-sm,3px)}pre code{background:none;padding:0}
blockquote{margin:var(--space-5,24px) 0;padding:var(--space-1,4px) 0 var(--space-1,4px) var(--space-4,16px);border-left:4px solid var(--accent-edge,#d9bfd8);color:var(--text-body,#2b2b2b)}
ul,ol{padding-left:1.4em}li{margin:.25em 0}hr{border:0;border-top:var(--rule,2px) solid var(--border,#0a0a0a);margin:var(--space-7,48px) 0}
table{border-collapse:collapse;width:100%;font-size:var(--mono-small,.8125rem);display:block;overflow:auto}th,td{text-align:left;vertical-align:top;padding:var(--space-2,8px) var(--space-3,12px);border-bottom:1px solid var(--border-faint,#eceae6)}
th{border-bottom:var(--rule,2px) solid var(--border,#0a0a0a);text-transform:uppercase;letter-spacing:var(--tracking-caps,.16em);font-size:var(--mono-caption,.6875rem)}
img{max-width:100%}
.gaps{margin-top:var(--space-8,64px);padding-top:var(--space-4,16px);border-top:1px solid var(--border-faint,#eceae6);font-size:var(--mono-caption,.6875rem);color:var(--text-muted,#6b6e6e);letter-spacing:var(--tracking-caps,.16em);text-transform:uppercase}
.gaps li{list-style:none;margin:.2em 0;text-transform:none;letter-spacing:0;font-size:var(--mono-small,.8125rem)}.gaps ul{padding:0;margin:var(--space-2,8px) 0 0}
.none{color:var(--text-muted,#6b6e6e)}.none h1{color:var(--text-muted,#6b6e6e)}
`;

// What stays missing is SAID, at the foot of the face — never hidden, never a reason to show nothing.
function gapNote(gaps) {
  if (!gaps || !gaps.length) return "";
  return `<aside class="gaps">rendered from source, with ${gaps.length} piece${gaps.length === 1 ? "" : "s"} not found<ul>` +
    gaps.map((g) => "<li>" + esc(g) + "</li>").join("") + "</ul></aside>";
}

// Build the chamber document for a resolved face (press/face.mjs). `nonce` must be fresh per render.
//   tokens  the design-system CSS as text (colors + spacing + typography), inlined
//   fonts   { display?, mono? } as data: URLs
export function chamberFor(face, { nonce, tokens = "", fonts = {} } = {}) {
  if (!nonce || !/^[A-Za-z0-9+/_-]{16,}$/.test(nonce)) throw new Error("chamber: a fresh nonce is required");
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp(nonce)}">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><script nonce="${nonce}">${forwarder()}</script>`;
  const style = `<style>${fontFaces(fonts)}${tokens}${READING}</style>`;

  if (face.face === "none" && face.unreachable) {
    // DID NOT ANSWER is a different fact from NOTHING HERE, and saying the second when the first is true
    // would be a lie about somebody's place. No network came back at all: DNS may not know the name yet,
    // or this device is offline.
    return `<!doctype html><html lang="en"><head>${head}<title>did not answer</title>${style}</head><body><main class="none">` +
      `<h1>This name did not answer.</h1><p><code>${esc(face.unreachable)}</code> could not be reached from here. It may not be laid yet, or this device may be offline. Nothing is known about what is there.</p></main></body></html>`;
  }
  if (face.face === "none") {
    const tried = (face.tried || []).map((t) => "<li><code>" + esc(t) + "</code></li>").join("");
    return `<!doctype html><html lang="en"><head>${head}<title>nothing here yet</title>${style}</head><body><main class="none">` +
      `<h1>Nothing here yet.</h1><p>This name answered, and had no face to show. Looked for:</p><ul>${tried}</ul></main></body></html>`;
  }

  if (!face.fragment) {
    // A whole document came out of the bottle's own layout chain. It keeps its shape; the room's rules go
    // in FIRST — the policy must be parsed before anything it governs — and its stylesheet links, which
    // cannot load here, are backed by the reading styles so it is never a bare wall of Times.
    const doc = String(face.html);
    const inject = head + style;
    if (/<head[^>]*>/i.test(doc)) return doc.replace(/<head[^>]*>/i, (m) => m + inject) .replace(/<\/body>/i, gapNote(face.gaps) + "</body>");
    return "<!doctype html><html><head>" + inject + "</head>" + doc.replace(/^\s*<!doctype[^>]*>/i, "") + gapNote(face.gaps) + "</html>";
  }

  return `<!doctype html><html lang="en"><head>${head}<title>${esc(face.title)}</title>${style}</head><body><main>` +
    face.html + gapNote(face.gaps) + `</main></body></html>`;
}

// A nonce for one render. crypto.getRandomValues exists in every secure context and in Node.
export function freshNonce(random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return [...random(18)].map((b) => "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"[b & 63]).join("");
}
