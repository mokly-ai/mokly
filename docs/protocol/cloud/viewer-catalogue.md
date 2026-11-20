# Viewer Catalogue

Status: The receiver does not run the content check yet, so the app can load an index or an entry detail that the core readers refuse. The [receiver read-model validation item](../../../plans/follow-ups/receiver-read-model-validation.md) adds the check.

This is the public-catalogue sub-contract of [Viewer](./viewer.md).
The app reads the catalogue index v9 and the entry details v4 that
the Mokly CLI publishes, and the workspace `@mokly/viewer` reads both
with its public readers. The Mokly protocols and public
declarations own this model; cloud code does not build a parallel Browse tree
or infer entries from artifact filenames.

## Fetch And Version Gate

Fetch `<catalogueOrigin>/mokly-viewer/index.json` and each entry detail from
the immutable publication's sandbox origin. A current entry's
detail is `mokly-viewer/entries/<path>.json`, and a removed entry's detail is
`entries/<path>.json` beneath the comparison generation that the index's
`comparisonUrl` names, `mokly-viewer/diffs/generations/<generation>/`.
[Viewer host](./viewer-host.md#sources) defines the credential
policy and the renewal after a 401. Reject cross-origin redirects and
unsuccessful responses.

The public readers accept index `schemaVersion: 9` and detail
`schemaVersion: 4` only. They copy content without validation. The receiver
checks the index and every entry detail before it completes an upload, as
[Catalogue Content](../mokly-upload-validation.md#catalogue-content) requires.
Every other version throws `MoklyVersionError` before entry or
path use. Preserve that type for the
[version failure](./viewer-host.md#version-failure). Never convert old IDs or
namespace paths to make older JSON readable.

## Read Model

The installed `@mokly/mokly` package defines the fields of the index and the
details, and this repository does not restate them. In that
package's `docs/protocol` directory, `mokly-catalogue.md` (Public Catalogue
Read Model) defines the index records with their views and variants;
`mokly-shell-delivery.md` (Shell Delivery And Read Model Routes) defines the
index and entry detail routes and fields; `mokly-catalogue-tree.md` (Catalogue
Tree) defines the one `tree` and the Specs and Components sections the package
derives from it; `mokly-moves.md` (Moves) and `mokly-catalogue-changes.md`
(Catalogue Change Metadata And Removed Pages) define paired records and
`previousPath`; `mokly-catalogue-serialization.md` (Catalogue Serialization,
Identity And Versions) defines the canonical bytes, the `snapshotId` and
`detailId` identities and the reader version gate; and
`mokly-removed-previews.md` (Removed Content Previews) defines removed records
and their `preview` descriptor.

The host relies on these rules at its boundary:

- Resolve catalogue paths against the source origin root, not the app URL.
- Entry paths follow [Viewer address state](./viewer-address-state.md#selection-mapping).
- The package splits the shared tree into Specs and Components; the host
  never reconstructs those sections.
- The cloud API lists comparison-backed current screens only; see
  [Viewer read model](./viewer-read-model.md#screens--listscreens).

## Snapshots

`catalogueSnapshot` carries a removed record's `snapshotId`: 64 lowercase
hexadecimal characters. It is a selection key, not an access capability. A
path-only historical selection normalizes to the advertised snapshot; stale or
unknown snapshots fail closed.

## Delivery And Isolation

Current documents derive from entry path, viewport and scheme beneath
`static/mokly-generated/`. Canonical entry shell URLs are `/view/<path>/`.
Every shell route serves the same stub, which renders Browse in the browser
from the index and the details. Frame probe navigation uses wire
v3 and `screenPath`. These are package-owned bytes and protocols.

The app does not import the package's standalone browser entry and reads no
route that only Serve answers, such as the live descriptor or the event
stream. Current screen frames use URLs on the sandbox catalogue origin.
The viewer fetches comparison and removed-preview HTML from that origin, then
renders it in script-disabled `srcdoc` frames at the app origin. Their images,
fonts and styles still load from the catalogue origin under the
[isolation policy](./viewer.md#catalogue-isolation).
