# Seized by the offline origin

This branch (`origin-held`) carries a signed origin-declaration in `.origin.json`.
It is not a GitHub setting. GitHub never verified it and cannot; verification is client-side.

- **repo**: fccn-antibody/anecdote.channel
- **ref**: refs/heads/origin-held
- **held_since**: 2026-07-10T00:00:00Z
- **origin**: `key:sha256:8a30f38af3b7d88bbe2b672e5a6a3e0eab26375c302126dcd9e0dcc7850b513c`

Only the device that HOLDS this key can re-declare (supersede) it. A hostile push is
detectable, not preventable — verify-from-anyone; trust decides action, not admission.

`main` is untouched. Reverse = delete this branch.
