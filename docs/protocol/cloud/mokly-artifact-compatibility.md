# Mokly Artifact Compatibility

The cloud uses the public artifacts and documented exports of
**`@mokly/mokly@0.19.0`**, **`@mokly/viewer@0.19.0`** and
**`@mokly/ui@0.19.0`** together. The receiver, the app, the
mockups, the site and the tooling implement these formats.

Use published file artifacts and documented exports only. Never import Mokly
internals, vendor source or patch its runtime. Shipped protocols take
precedence over later upstream main and intermediate changelog numbers. A
changelog's `Unreleased` section is not a release promise. The format
inventory, the generated declarations and the public readers decide each
version. Where a released prose page names another number, such as
`schemaVersion: 8` for the index in `mokly-shell-delivery.md`, the cloud still
requires index 9.

## Released Contract Sources

Read these documents from the exact published 0.19.0 package, not upstream
main:

- Wire and receiver validation: `mokly-upload.md`, `mokly-upload-exchange.md`,
  `mokly-upload-validation.md`, `mokly-export-ownership.md`,
  `fixtures/export-ownership-v3.json` and `fixtures/upload-plan-v1.json`.
- Versions and namespace: Supported Formats in `docs/protocol/cloud/README.md`,
  `mokly-format-versions.md` and `mokly-viewer-namespace.md`.
- Index and Changes: `mokly-catalogue.md`, `mokly-catalogue-delivery.md`,
  `mokly-catalogue-serialization.md`, `mokly-catalogue-changes.md` with its
  Changes count, `mokly-moves.md`, `mokly-shell-delivery.md` and
  `fixtures/catalogue-v9.json`.
- Static output and delivery: `mokly-export.md`, `mokly-publication.md`,
  `mokly-export-delivery.md`, `mokly-artifact-paths.md`,
  `mokly-comparison-serving.md` and `mokly-removed-previews.md`.
- Viewer: `mokly-viewer.md`, `mokly-viewer-api.md`, `mokly-shell-fences.md`,
  `mokly-comparison-panes.md`, `mokly-frame-adapter.md` and
  `fixtures/entry-details-v4.json`, with the viewer README, public
  declarations and documented exports.
- Shared UI: `mokly-ui-package.md`, with the `@mokly/ui` README and public
  declarations.
- Comparison, configuration and CLI errors: `mokly-comparison.md`,
  `mokly-base-dependencies.md`, `mokly-configuration.md` and
  `mokly-terminal-errors.md`.
- Imported styles: `mokly-configuration-imported-styles.md`,
  `mokly-imported-styles.md`, `mokly-imported-styles-assets.md` and
  `mokly-export-public-files.md`.

Cloud's additional receiver choices live in [Publication upload](./publication-upload.md),
[exchange](./publication-upload-exchange.md),
[validation](./publication-upload-validation.md) and
[index](./publication-review.md). They never redefine the published wire
format. The receiver, app and tooling use this release family.

## Published Package Inventory

| Package         | Pin    | Cloud use                                                            |
| --------------- | ------ | -------------------------------------------------------------------- |
| `@mokly/mokly`  | 0.19.0 | The CLI that serves, builds and publishes catalogues, and its guides |
| `@mokly/viewer` | 0.19.0 | The embedded viewer and its public readers                           |
| `@mokly/ui`     | 0.19.0 | The presentational parts that the viewer mockups compose             |

The three packages share one version. The CLI depends on the exact viewer
version, and the viewer depends on the exact `@mokly/ui` version. The exact pins apply to every npm workspace
package that consumes a package, and the single lockfile records each
release's registry URL and integrity. Local archives and source copies cannot
replace these pins. The `mokly` command runs an exact native package for Linux
x64 or ARM64 with glibc 2.28 or newer, macOS 11 or newer, or Windows x64,
with no JavaScript fallback and no musl build.

## Version Boundary

Released `mokly-format-versions.md` and `mokly-viewer-namespace.md` define
these independent versions. The cloud uses them together.

| Boundary                               | Released version               | Cloud use                                                             |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| Upload envelope                        | 3                              | Strict ten-field `mokly-upload.json` parser                           |
| Export ownership marker                | 3                              | `.mokly-export-artifact` parser                                       |
| Plan response/exchange                 | 1                              | Plan, blob and completion transport                                   |
| Catalogue index                        | 9                              | Plan checks, Changes count, check links, screens and the app's viewer |
| Entry detail                           | 4                              | The app's viewer; the receiver parses none                            |
| Static deployment file                 | 1                              | Served unchanged; the receiver parses none                            |
| Frame probe wire envelope              | 3                              | Packaged frame adapter and frame probe                                |
| Removed page/document preview metadata | 3                              | Packaged removed-preview reader                                       |
| Historical snapshot identity domain    | `mokly-historical-snapshot-v3` | Package-generated 64 lowercase hex identity                           |

0.19.0 has no private generated manifest, no review file, no static delivery
descriptor and no shell bootstrap envelope. The review result
and the catalogue change snapshot exist only in memory, so no upload or served
file carries them. Never infer Changes from rendered views or
file names; the index records carry them. Envelope unknown fields fail; marker
unknown fields are ignored.

Require an object root before probing its artifact version; positional arrays
are invalid bundles, including arrays that begin with a version number.
Check an artifact version before its typed body or paths. The receiver
accepts only envelope 3, marker 3 and index 9. Every other
envelope or index version, and every marker version other than 3, returns
HTTP 426 `upload-unsupported-version`, with the artifact kind in the typed
error. The API reason and data shape are in
[REST API](./rest-api.md#reason-catalogue). SemVer syntax is independent;
a producer version string never authorizes a different schema.

Decision: the envelope 3 and index 9 gates are the only version gates, and the
receiver has no `moklyVersion` floor. These gates already answer
426 to every earlier producer: releases up to 0.16 write envelope 2, and 0.17
writes index 8. Rejected: a floor at 0.18.0, because it refuses no extra
producer; version checks of each detail and preview file on arrival, because
the receiver parses none of them; and accepting only the pinned release,
because it refuses compatible patch releases.

### Ownership Schema 3 Boundary

Schema 3 declares `{ path, sha256, size }` entries, the limits and the
plan/blob/completion exchange, and it gates the portable `mokly-viewer/`
namespace. The receiver classifies the artifact version first and accepts
the comparison paths per
[upload validation](./publication-upload-validation.md).

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
| `mokly-viewer/client/**`, `mokly-viewer/shell.css`, `mokly-viewer/fonts/**` | Shell bundle, frame probe, styles and fonts                                       |
| `mokly-viewer/diffs/generations/<64 lowercase hex>/**`                      | Removed details, snapshots, their resources and removed previews, with `no-store` |
| `mokly-upload.json`, `.mokly-export-artifact`                               | Private ingest metadata                                                           |

A comparison generation holds no review file. 0.19.0 writes no
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
sides from sources with the installed release. A base whose
sources fail current validation makes Changes unavailable, and the upload then
has no comparison. See [Mockups](./mockups.md) and
[Mockup tooling](./mockup-tooling.md).

## Private Artifact Limit

Viewer 0.19.0 sends `credentials: "omit"` on URL sources, the static
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
Holding the upgrade until a
Mokly release adds a credentialed transport was rejected. The cloud never
patches the package, replaces global `fetch`, deep-imports internals or
exposes private files to restore these reads, because no package pin permits
weaker authorization or a runtime patch. See
[Viewer](./viewer.md#private-artifact-limit) and
[Catalogue hosting](./catalogue-hosting.md#private-access).

## Release 0.19 Frame Boundary

Published pages use `mokly-viewer/client/frame-probe.js`, channel
`mokly-frame-probe` and frame wire version 3. The viewer and pages from
0.18 reject each other's frame protocol. Republish existing catalogues with
0.19.0 after deploying the matching app. Stored publications are not converted.

The public index and detail readers gate versions and return copies.
They do not validate content. The cloud receiver keeps its documented
index validation and rejection cases.

## Fixture Ownership

The contract fixtures are committed golden files beside their consumer, not
disposable generated output. `cargo xtask mokly-fixtures` regenerates them,
`--check` fails on any byte or filename drift, and stage 18 runs check mode
unconditionally. Neither mode publishes a catalogue or edits the product
catalogue. Check mode also runs one authored index Changes-count corpus
through the Rust reader and the public `readCatalogueIndex` of the viewer.
The rule for that corpus is in
[Publication index](./publication-review.md#reader-conformance-and-cloud-checks).
The [fixture procedure](./mokly-fixture-regeneration.md) defines the frozen
sources, the fixed commits, the artifacts, the archive order and the checks.
Preserve real producer bytes; never normalize drift to conceal a decoder
mismatch.

The [CLI-code fixture](./mokly-fixture-regeneration.md#cli-failure-codes) adds
public CLI failure evidence to the fixture inventory and its checksums. The worker's
mapped codes are tested against it; regeneration and check mode run the pinned
CLI's failure scenarios in temporary repositories.

## Deliberate Package Bumps

A pin change is its own change. A protocol addition that the cloud relies on
must already exist in a published release. Never update a golden file merely
to suppress a failing decoder: a fixture drift error names the affected file
and requires a deliberate regeneration. The three packages move together,
because the CLI pins the viewer exactly and the viewer pins `@mokly/ui`
exactly. Every
bump therefore regenerates the producer fixtures and the index corpus, and
inspects the viewer's and the UI package's public types, protocols and
transport behaviour before adoption.

Decision: a bump that changes a format replaces every reader of the old format
in the same change, so no code reads two format families. A staged change
whose receiver and app read both families was rejected, because that code is
thrown away at the next step. Decision: the cloud converts no stored
publication to a new format, because the new viewer cannot render an old
catalogue. A reader for stored 0.14.0 reviews was rejected. The
[deploy runbook](../../ops/deploy.md) gives the reset that removes the old
publications.
