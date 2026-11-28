# Mokly Artifact Delivery

Status: The app still offers **Open catalogue in a new tab**. The [blocked stage words milestone](../../../plans/private-catalogue-embedded-access.md#milestone-9-blocked-stage-words) removes it.

This is the delivery sub-contract of
[Artifact compatibility](./mokly-artifact-compatibility.md). It gives the
paths that the cloud stores and serves, and the private artifact limit.

## Stored And Served Paths

Exports use these paths; the cloud stores and serves them unchanged.

| Export-relative path                                                        | Purpose                                                                           |
| --------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `index.html`, `404.html`, `view/<path>/index.html`                          | The shell stub, with the same bytes for every route                               |
| `static/mokly-generated/<path>/index[.<viewport>][.dark].html`              | Current rendered views and documents                                              |
| `static/mokly-generated/styles/**`, `static/mokly-generated/assets/**`      | Bundled stylesheets and CSS assets                                                |
| `static/**` outside the generated tree                                      | Referenced authored closure                                                       |
| `mokly-viewer/index.json`                                                   | Catalogue index 9, also carried in the Plan archive                               |
| `mokly-viewer/entries/<path>.json`                                          | Entry detail 4 of each current entry                                              |
| `mokly-viewer/deployment.json`                                              | Static deployment file 1                                                          |
| `mokly-viewer/client/**`, `mokly-viewer/shell.css`, `mokly-viewer/fonts/**` | Shell bundle, frame probe, start page, access worker, styles and fonts            |
| `mokly-viewer/diffs/generations/<64 lowercase hex>/**`                      | Removed details, snapshots, their resources and removed previews, with `no-store` |
| `mokly-upload.json`, `.mokly-export-artifact`                               | Private ingest metadata                                                           |

A comparison generation holds no review file. Mokly writes no
private manifest and no comparison summary, and the
[hosting policy](./publication-upload-validation.md#hosting-policy) still
refuses both names. The server serves or rewrites no `__mokly/` path and
provides no `__generations/` alias. Fixed Mokly deployed segments have no `_`
prefix. Cloud keeps `_access` and `__blobs` reserved. Authored names follow
their own grammar; the hosting policy must reject those cloud roots.

Entries have file-derived paths: the configuration declares `roots`, a
variant has a slug, and links use paths. No Mokly command writes catalogue
output into the repository except `build`, into an ignored output directory,
so no catalogue output is committed. A comparison renders both
sides from sources with the CLI that runs it. A base whose
sources fail current validation makes Changes unavailable, and the upload then
has no comparison. See [Mockups](./mockups.md) and
[Mockup tooling](./mockup-tooling.md).

## Private Artifact Limit

The viewer sends `credentials: "omit"` on URL sources, the static
deployment file, comparison pane documents and removed-preview documents.
The standalone shell sends `credentials: "same-origin"` on its
index, detail, deployment, comparison and removed-preview reads.
The root React API
accepts index and detail objects, so the app fetches the index and every
detail itself, for public and private catalogues, with the catalogue cookie
for a private one. The package has no transport for comparison documents or
removed previews. Private comparisons and removed-entry previews stay unavailable
in the embedded viewer. The standalone shell needs a catalogue cookie
in its own browser cookie store.

Only the app's `POST /_access` sets the catalogue cookie. A browser that
blocks third-party cookies refuses that cookie or keeps it in the app's own
store, so a new tab or the system browser never holds it. Decision: the app
offers no **Open catalogue in a new tab** recovery,
because a browser that refused the app cookie has none for that tab either.
The cloud never patches the package at run time, replaces global `fetch`,
deep-imports internals or exposes private files to restore these reads,
because it uses only the viewer's documented exports. A credentialed
transport is a change to the viewer package and its protocol. See
[Viewer](./viewer.md#private-artifact-limit) and
[Catalogue hosting](./catalogue-hosting.md#private-access).
