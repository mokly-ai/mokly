# Mokly Artifact Compatibility

Status: The receiver does not run the content check yet. It checks only the index fields that its own features read, and it reads no entry detail. The [receiver read-model validation item](../../../plans/follow-ups/receiver-read-model-validation.md) adds the check.

The cloud uses the public artifacts and documented exports of the workspace
packages `@mokly/mokly`, `@mokly/viewer` and `@mokly/ui` together. The
receiver, the app, the mockups, the site and the tooling implement these
formats.

Use file artifacts and documented exports only. Never import Mokly internals,
vendor source or patch its runtime. The Mokly protocol docs of the same commit
are the contract, and the format inventory, the generated declarations and the
public readers decide each version. Where a Mokly prose page names another
number, such as `schemaVersion: 8` for the index in
[Mokly shell delivery](../mokly-shell-delivery.md), the cloud still requires
index 9.

## Contract Sources

Read these Mokly protocol docs and fixtures from this repository:

- Wire and receiver validation: [upload](../mokly-upload.md),
  [upload exchange](../mokly-upload-exchange.md),
  [upload validation](../mokly-upload-validation.md),
  [export ownership](../mokly-export-ownership.md),
  [`fixtures/export-ownership-v3.json`](../fixtures/export-ownership-v3.json)
  and [`fixtures/upload-plan-v1.json`](../fixtures/upload-plan-v1.json).
- Versions and namespace: [Supported Formats](../README.md#supported-formats),
  [format versions](../mokly-format-versions.md) and
  [viewer namespace](../mokly-viewer-namespace.md).
- Index and Changes: [catalogue](../mokly-catalogue.md),
  [catalogue delivery](../mokly-catalogue-delivery.md),
  [catalogue serialization](../mokly-catalogue-serialization.md),
  [catalogue changes](../mokly-catalogue-changes.md) with its Changes count,
  [moves](../mokly-moves.md), [shell delivery](../mokly-shell-delivery.md) and
  [`fixtures/catalogue-v9.json`](../fixtures/catalogue-v9.json).
- Static output and delivery: [export](../mokly-export.md),
  [publication](../mokly-publication.md),
  [export delivery](../mokly-export-delivery.md),
  [artifact paths](../mokly-artifact-paths.md),
  [comparison serving](../mokly-comparison-serving.md) and
  [removed previews](../mokly-removed-previews.md).
- Viewer: [viewer](../mokly-viewer.md), [viewer API](../mokly-viewer-api.md),
  [shell fences](../mokly-shell-fences.md),
  [comparison panes](../mokly-comparison-panes.md),
  [frame adapter](../mokly-frame-adapter.md) and
  [`fixtures/entry-details-v4.json`](../fixtures/entry-details-v4.json), with
  the viewer README, public declarations and documented exports.
- Shared UI: [UI package](../mokly-ui-package.md), with the `@mokly/ui` README
  and public declarations.
- Comparison, configuration and CLI errors: [comparison](../mokly-comparison.md),
  [base dependencies](../mokly-base-dependencies.md),
  [configuration](../mokly-configuration.md) and
  [terminal errors](../mokly-terminal-errors.md).
- Imported styles:
  [configuration imported styles](../mokly-configuration-imported-styles.md),
  [imported styles](../mokly-imported-styles.md),
  [imported style assets](../mokly-imported-styles-assets.md) and
  [export public files](../mokly-export-public-files.md).

Cloud's additional receiver choices live in [Publication upload](./publication-upload.md),
[exchange](./publication-upload-exchange.md),
[validation](./publication-upload-validation.md) and
[index](./publication-review.md). They never redefine the Mokly wire format.

## Workspace Package Inventory

| Package         | Workspace path    | Cloud use                                                            |
| --------------- | ----------------- | -------------------------------------------------------------------- |
| `@mokly/mokly`  | `packages/mokly`  | The CLI that serves, builds and publishes catalogues, and its guides |
| `@mokly/viewer` | `packages/viewer` | The embedded viewer and its public readers                           |
| `@mokly/ui`     | `packages/ui`     | The presentational parts that the viewer mockups compose             |

The three packages share one version. The CLI depends on the exact viewer
version, and the viewer depends on the exact `@mokly/ui` version. The one
lockfile links every cloud project that consumes a package to its workspace
path, and no project installs a registry copy. Decision: workspace use, not
exact pins on published releases, as
[Repository layout](../repository-layout.md#boundary) records. The `mokly`
command runs an exact native package for Linux x64 or ARM64 with glibc 2.28 or
newer, macOS 11 or newer, or Windows x64, with no JavaScript fallback and no
musl build.

## Version Boundary

[Format versions](../mokly-format-versions.md) and
[viewer namespace](../mokly-viewer-namespace.md) define these independent
versions. The cloud uses them together.

| Boundary                               | Version                        | Cloud use                                                             |
| -------------------------------------- | ------------------------------ | --------------------------------------------------------------------- |
| Upload envelope                        | 3                              | Strict ten-field `mokly-upload.json` parser                           |
| Export ownership marker                | 3                              | `.mokly-export-artifact` parser                                       |
| Plan response/exchange                 | 1                              | Plan, blob and completion transport                                   |
| Catalogue index                        | 9                              | Plan checks, Changes count, check links, screens and the app's viewer |
| Entry detail                           | 4                              | The receiver's content check and the app's viewer                     |
| Static deployment file                 | 1                              | Served unchanged; the receiver parses none                            |
| Frame probe wire envelope              | 4                              | Packaged frame adapter and frame probe                                |
| Removed page/document preview metadata | 3                              | Packaged removed-preview reader                                       |
| Historical snapshot identity domain    | `mokly-historical-snapshot-v3` | Package-generated 64 lowercase hex identity                           |

Mokly writes no private generated manifest, no review file, no static
delivery descriptor and no shell bootstrap envelope. The review result
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
producer; a separate gate for each detail and preview file, because the
[content check](../mokly-upload-validation.md#catalogue-content) already
checks each detail version, and the receiver parses no preview file; and
accepting only the workspace version, because it refuses compatible published
releases.

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

## Frame Boundary

Published pages use `mokly-viewer/client/frame-probe.js`, channel
`mokly-frame-probe` and frame wire version 4. A viewer and a page with
different frame wire versions reject each other's frame protocol, so pages
that a Mokly release with an earlier frame wire version published do not
work in the viewer. Republish such catalogues after the matching app
deploys. Stored publications are not converted.

The public index and detail readers gate versions and return copies.
They do not validate content. The receiver checks the content, as
[Catalogue Content](../mokly-upload-validation.md#catalogue-content) requires.

## Fixture Ownership

The contract fixtures are committed golden files beside their consumer, not
disposable generated output. `cargo xtask mokly-fixtures` regenerates them
from the workspace build, `--check` fails on any byte or filename drift, and
the `cloud-fixtures` suite
runs check mode unconditionally. Neither mode publishes a catalogue or edits the product
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
mapped codes are tested against it; regeneration and check mode run the
workspace CLI's failure scenarios in temporary repositories.

## Mokly Changes

A Mokly change reaches the cloud in the same commit, without a release. A
change to an upload artifact, a format or a public export updates the Mokly
protocol docs, regenerates the producer fixtures and the index corpus, and
updates the cloud readers in the same change. Never update a golden file
merely to suppress a failing decoder: a fixture drift error names the affected
file and requires a deliberate regeneration. Customers publish with released
CLIs, so the receiver keeps the version gates above, and a protocol addition
that the cloud requires in an upload must already exist in a published
release.

Decision: a change that changes a format replaces every reader of the old format
in the same change, so no code reads two format families. A staged change
whose receiver and app read both families was rejected, because that code is
thrown away at the next step. Decision: the cloud converts no stored
publication to a new format, because the new viewer cannot render an old
catalogue. A reader for stored 0.14.0 reviews was rejected. The
[deploy runbook](../../ops/deploy.md) gives the reset that removes the old
publications.
