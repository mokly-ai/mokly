# Combined Path And Output Format Versions

## Delivery Status

The frozen TypeScript backend implements manifest v10, catalogue v6, and
review v7 under [path identity in one generated tree](./mokly-path-output-integration.md).
The [Rust rebuild plan](../../plans/rust-rebuild.md) is the approved target for
the numbers below; that line writes no generated tree and no baseline cache.
One format number denotes one shape and interpretation.
Readers accept only the current number; checking older data is not a content
compatibility reader, and no reader for an earlier number exists.

## Version Inventory

| Boundary                                | Version                   | Reason and reader                                                                                                                      |
| --------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Private generated manifest              | none                      | Retired: the catalogue model lives in memory and the read model is its public form; nothing is written.                                |
| Public complete/scoped catalogue        | 7                         | Follows the source-rendered catalogue model and review v8 evidence; screens carry props and controls; public/scoped readers require 7. |
| Review result                           | 8                         | Tree materiality, owner-attributed rule and resource evidence, moves; producers and decoders require 8.                                |
| Catalogue change snapshot               | 4                         | Current private path/move/removal evidence paired with review v8 and the base commit.                                                  |
| Live catalogue index                    | `live-index-3`            | Source-rendered entry and folder shapes with source-only metadata.                                                                     |
| Shell bootstrap envelope                | 3                         | Required version plus path-based view, catalogue v7 or external reference, and delivery v5.                                            |
| Baseline completion marker              | none                      | Retired: both sides render from sources; no baseline cache exists.                                                                     |
| Static delivery descriptor              | 5                         | Unchanged: path/index canonical URLs and the current namespace.                                                                        |
| Private live capability descriptor      | 2                         | Unchanged: path-keyed workspace/request identities.                                                                                    |
| Inspector wire envelope                 | 2                         | Unchanged: navigation carries `screenPath`; both peers require 2 before message fields.                                                |
| Removed page/document preview metadata  | 3                         | Unchanged `{schemaVersion,baseRef,baseCommit,path}` shape.                                                                             |
| Export ownership                        | 3                         | Unchanged exact `{path,sha256,size}` inventory, bounds and namespace; written by `build`.                                              |
| Upload metadata                         | 2                         | Unchanged strict envelope and `mokly-viewer/` comparison namespace; Mokly Cloud implements it.                                         |
| Plan response/exchange                  | 1                         | Unchanged content-delta fields, expiry and digest accounting; Mokly Cloud implements it.                                               |
| Navigation disclosure storage           | `mokly:nav-disclosure:v4` | Unchanged path-keyed folder/variant storage.                                                                                           |
| Export transaction marker               | 2                         | Unchanged `{schemaVersion,output}` basename ownership shape; written by `build`.                                                       |
| Verification process-owner records      | 1                         | Unchanged PID/token/process-lifetime shape.                                                                                            |
| Browser module inventory                | 1                         | Unchanged exact module-path inventory shape.                                                                                           |
| Timing records and verification reports | 1                         | Unchanged timing/runner evidence shape.                                                                                                |

The frozen backend's accepted output snapshot format has no successor; the
Rust render graph holds generations in memory without a private IPC format.
Lock-holder files keep their PID/token identities; do not confuse tokens,
generation hashes, event revisions or package versions with format versions.

Root configuration, `_folder.json`, YAML front matter and Markdown front matter
are strict unversioned authoring schemas: new authoring inputs, not a second
interpretation of persisted catalogue data. No stored-state converter or
fallback exists for any boundary.

## Catalogue Model

The Rust core keeps the catalogue model in memory and writes no manifest.
Entries keep the path-based fields of the frozen manifest for screens, pages,
documents, use cases, components and variants, and add the HTML and YAML file
kinds of the [HTML screens contract](./mokly-html-screens.md). Usage records
derive their instance, slot and root regions from the composed trees under the
[comparison contract](./mokly-comparison.md) and carry no text offsets.
Resource owners exclude CSS. The read model v7 is the model's public form, and
the generated TypeScript types in the model crate are the normative shapes;
no `Manifest` or `HistoricalManifest` type exists.

## Rejection Before Interpretation

Reject versions before reading identity, route, resource or nested payload
fields. Catalogue v6 and below are unsupported by the v7 reader; a frozen manifest is
not read at all; review v7 and below are unsupported comparison results. Unknown newer versions are invalid, never the
graceful earlier-baseline result.

Delivery stays a `valid`/`unsupported-version`/`invalid` classifier.
Catalogue, bootstrap and review readers use `MoklyVersionError` at their
version gates. The review gate rejects numeric versions other than 8 before
content validation; malformed current results keep the plain invalid-review
error. The static build maps invalid/unsupported delivery to the
`export-invalid` context. Inspector peers reject a mismatched wire version
before processing navigation. No field renaming or path conversion rescues an
unsupported payload.

A base commit is rendered from its sources by the current version, so no
earlier-format base exists. A base whose sources fail the current validation
makes Changes unavailable with those diagnostics, and that outcome is not
cached.

Older receivers retain HTTP 426 handling with no Blob/Complete request or
downgrade. Ownership and upload versions are unchanged because their own
fields and namespace are unchanged; catalogue and review readers independently
enforce their payload versions. Mokly Cloud adopts catalogue v7, review v8 and
bootstrap v3 in the same window as the first release of the Rust core.

## Acceptance

Test every changed version boundary with the frozen backend's formats and an
unknown newer version. Confirm rejection precedes getters for identity/path
fields. Update complete/scoped, static/live, packed-consumer, upload and
browser fixtures together. Keep old-version fixtures only as rejection tests.
Verify unavailable Changes with a base whose sources fail current validation,
and moved comparisons and removed previews with a base rendered from Git.
