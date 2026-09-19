// press/exhibit.mjs — read a README the way library.anecdote.channel/EXHIBIT.md says a renderer may:
//
//   THE METATAGS ARE THE FRONT MATTER.  Keys naming the canon (CONSTITUTION, AGENTS, LICENSE, OPEN, NAME)
//                                       become buttons. Keys this does not recognise are ignored, never
//                                       guessed at: lowercase is a project's own vocabulary.
//   THE STRIP.                          "The first link list after the title is the navigation." Real
//                                       markdown links, where a reader would look anyway. Here they become
//                                       tabs; with no renderer they are still a row of working links.
//
// That document leaves the renderer to anecdote.channel ("which renderer draws the strip as tabs, and how,
// belongs to anecdote.channel"). This is the reading half of it: pure, source in, description out. Nothing
// is added to the markdown to make it work, so nothing breaks where this is absent.

import { frontMatter } from "../jekyll-enough/yaml.mjs";

// The canon, in the order the buttons are drawn. README is the door itself and is never a button.
export const CANON = ["name", "constitution", "agents", "license", "open"];

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

// A strip is a paragraph that is NOTHING BUT links and the separators between them. A sentence that happens
// to contain two links is prose, and prose is never promoted to navigation.
function linksOnly(block) {
  const links = [...block.matchAll(LINK)].map((m) => ({ label: m[1].replace(/[`*_]/g, ""), href: m[2] }));
  if (links.length < 2) return null;
  const rest = block.replace(LINK, "").replace(/^\s*[-*+]\s+/gm, "").replace(/[\s·•|,/–—-]+/g, "");
  return rest === "" ? links : null;
}

export function exhibitOf(source) {
  const { data, body } = frontMatter(String(source == null ? "" : source));
  const canon = [];
  for (const key of CANON) {
    const v = data && data[key];
    if (typeof v === "string" && v && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(v) && !v.split("/").includes("..")) canon.push({ key, path: v });
  }

  // Walk blocks (blank-line separated) from the title down. The strip must come BEFORE any other prose:
  // once a paragraph of words has gone by, a later link list is a list, not the navigation.
  const blocks = body.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let title = "", strip = [], seenTitle = false;
  for (const block of blocks) {
    const h = /^#\s+(.+)$/.exec(block);
    if (!seenTitle) { if (h) { title = h[1].trim(); seenTitle = true; } continue; }
    const links = linksOnly(block);
    if (links) strip = links;
    break;
  }
  return { title, canon, strip, permalink: (data && typeof data.permalink === "string") ? data.permalink : null };
}
