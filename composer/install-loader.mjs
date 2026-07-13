// composer/install-loader.mjs — the consumer half of the install grammar: mount the VERIFIED client blobs
// (composer/install.mjs verifyInstall) as Blob URLs and import() the single named entry, handing back the
// live client. This is the glove: code borrowed at runtime, worn in the consumer's own context, dropped
// (revoke) on reload — an in-memory conversation, never a committed block.
//
// Only VERIFIED bytes reach here (verifyInstall checked every blob against the pinned platform key), so what
// mounts is platform-signed code or nothing. The blobs' internal wiring is their own concern: the loader
// exposes the whole { name -> url } map, so the entry can dynamic-import its siblings by url if it needs them
// — the loader never resolves cross-blob imports itself.
//
// createURL/importer are injected (defaulting to the real browser APIs) so the mount/import CONTRACT is
// Node-testable and the real Blob-URL import() is Chromium-verified.

// Mount verified files as URLs. Returns { urls: { name -> url }, entry: <entry url>, revoke() }.
export function mountInstall(verified, { createURL, revokeURL, mime = "text/javascript" } = {}) {
  if (!verified || !verified.ok || !verified.files || !verified.entry) throw new Error("install-loader: mount needs a verified install ({ ok, entry, files })");
  const mk = createURL || ((bytes) => URL.createObjectURL(new Blob([bytes], { type: mime })));
  const rm = revokeURL || ((u) => { try { URL.revokeObjectURL(u); } catch {} });
  const urls = {};
  for (const [name, bytes] of Object.entries(verified.files)) urls[name] = mk(bytes, name);
  return { urls, entry: urls[verified.entry], revoke: () => { for (const u of Object.values(urls)) rm(u); } };
}

// Mount + import the entry. Returns { module, urls, revoke } — `module` is the entry's live exports; `urls`
// lets the module reach its siblings; `revoke` frees every Blob URL (call it when the client is torn down).
// If the import throws, the mounted URLs are revoked before rethrowing (no leak on a bad entry).
export async function loadInstall(verified, { importer, ...opts } = {}) {
  const mounted = mountInstall(verified, opts);
  const imp = importer || ((u) => import(u));
  try {
    const module = await imp(mounted.entry);
    return { module, urls: mounted.urls, revoke: mounted.revoke };
  } catch (e) {
    mounted.revoke();
    throw e;
  }
}
