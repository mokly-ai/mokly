# Combined Path And Output Format Versions

Status: In progress under the [detail content ids plan](../../plans/detail-content-ids.md).

## Version Inventory

| Boundary                                | Version                   | Reason and reader                                                                                                                                                                                                       |
| --------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public catalogue index                  | 8                         | The read model without per-view usage and resource evidence, with `baseCommit`, the generation root, and each record's `detailId`; the reader requires 8.                                                               |
| Entry detail                            | 3                         | Per-view usage, review states, ignore ids, resource evidence, direct reasons, workspace lists, control order, and content `detailId`; current details carry `revision`, removed details carry `snapshotId`; requires 3. |
| Static deployment file                  | 1                         | `{deploymentId,schemaVersion}` at `mokly-viewer/deployment.json`; written by `build`, never by Serve.                                                                                                                   |
| Review result                           | 8                         | In memory only: tree materiality, owner-attributed rule and resource evidence, moves; never written or read from a file.                                                                                                |
| Catalogue change snapshot               | 4                         | In memory only: current private path/move/removal evidence paired with review v8 and the base commit.                                                                                                                   |
| Live descriptor                         | 3                         | A Serve JSON route with the render capability only; the index carries the one revision and the render generation.                                                                                                       |
| Inspector wire envelope                 | 2                         | Navigation carries `screenPath`; both peers require 2 before message fields.                                                                                                                                            |
| Removed page/document preview metadata  | 3                         | `{schemaVersion,baseRef,baseCommit,path}` shape.                                                                                                                                                                        |
| Export ownership                        | 3                         | Exact `{path,sha256,size}` inventory, bounds and namespace; written by `build`.                                                                                                                                         |
| Upload metadata                         | 3                         | Strict envelope without a comparison path; the Plan archive carries the index; Mokly Cloud implements it.                                                                                                               |
| Plan response/exchange                  | 1                         | Content-delta fields, expiry and digest accounting; Mokly Cloud implements it.                                                                                                                                          |
| Navigation disclosure storage           | `mokly:nav-disclosure:v4` | Path-keyed folder/variant storage.                                                                                                                                                                                      |
| Export transaction marker               | 2                         | `{schemaVersion,output}` basename ownership shape; written by `build`.                                                                                                                                                  |
| Verification process-owner records      | 1                         | PID/token/process-lifetime shape.                                                                                                                                                                                       |
| Browser module inventory                | 1                         | Exact module-path inventory shape.                                                                                                                                                                                      |
| Timing records and verification reports | 1                         | Timing/runner evidence shape.                                                                                                                                                                                           |

A format number changes only when the shape or the interpretation of its
format changes. Package 1.0.0 is the first release with a stable format
promise; before it, any release can change a number.

When several related changes merge between releases, the first change that
requires a new number raises each format that it changes. Later changes in the
same release window keep that number and add their shape to it. If a release
has not shipped, its next format number remains available for the first merged
change.

The catalogue model has no version, because Mokly never writes it. The index
carries the deployment id, the revision, the base commit, the comparison
generation's root, and each record's detail id. A detail never carries the
deployment id. The review result and the change snapshot live in memory. A
page embeds no state. Both sides of a comparison render from sources.
Lock-holder files keep their PID/token identities; do not confuse tokens,
generation hashes, event revisions or package versions with format versions.

Root configuration, `_folder.json`, YAML front matter and Markdown front matter
are strict unversioned authoring schemas: new authoring inputs, not a second
interpretation of persisted catalogue data. No stored-state converter or
fallback exists for any boundary.

## Catalogue Model

Entries carry path-based fields for screens, pages, documents, use cases,
components and variants, including the HTML and YAML file kinds of the
[HTML screens contract](./mokly-html-screens.md). Usage records
derive their instance, slot and root regions from the composed trees under the
[comparison contract](./mokly-comparison.md) and carry no text offsets.
Resource owners exclude CSS. The read model v8 is the model's public form. The
[generated TypeScript types](../../packages/viewer/src/generated/catalogue/)
are the normative shapes.

## Rejection Before Interpretation

Reject versions before reading identity, route, resource or nested payload
fields. The index reader rejects catalogue v7 and below; no manifest and no
review file is read. Unknown newer versions are invalid.

Index, detail, deployment file, and live descriptor readers use
`MoklyVersionError` at their
version gates. Inspector peers reject a mismatched wire version
before processing navigation. No field renaming or path conversion rescues an
unsupported payload.

A base commit is rendered from its sources by the current version, so no
earlier-format base exists. A base whose sources fail the current validation
makes Changes unavailable with those diagnostics, and that outcome is not
cached.

A receiver that does not support these versions answers HTTP 426, and the CLI
sends no Blob or Complete request and does not downgrade. The ownership and upload readers check their own
fields and namespace; catalogue readers independently enforce their payload
versions. Mokly Cloud implements upload metadata v3 and catalogue v8, reads
Changes from the index, and does not parse entry details or the static
deployment file.
