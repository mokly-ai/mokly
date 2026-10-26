# Combined Path And Output Format Versions

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Version Inventory

| Boundary                                | Version                   | Reason and reader                                                                                                              |
| --------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Public catalogue index                  | 8                         | The read model without per-view usage and resource evidence, with `baseCommit` and the generation root; the reader requires 8. |
| Entry detail                            | 2                         | Per-view usage, review states, ignore ids, resource evidence, direct reasons, workspace lists, and control order; requires 2.  |
| Review result                           | 8                         | In memory only: tree materiality, owner-attributed rule and resource evidence, moves; never written or read from a file.       |
| Catalogue change snapshot               | 4                         | In memory only: current private path/move/removal evidence paired with review v8 and the base commit.                          |
| Live descriptor                         | 3                         | A Serve JSON route with the render capability only; the index carries the one revision and the render generation.              |
| Inspector wire envelope                 | 2                         | Navigation carries `screenPath`; both peers require 2 before message fields.                                                   |
| Removed page/document preview metadata  | 3                         | `{schemaVersion,baseRef,baseCommit,path}` shape.                                                                               |
| Export ownership                        | 3                         | Exact `{path,sha256,size}` inventory, bounds and namespace; written by `build`.                                                |
| Upload metadata                         | 3                         | Strict envelope without a comparison path; the Plan archive carries the index; Mokly Cloud implements it.                      |
| Plan response/exchange                  | 1                         | Content-delta fields, expiry and digest accounting; Mokly Cloud implements it.                                                 |
| Navigation disclosure storage           | `mokly:nav-disclosure:v4` | Path-keyed folder/variant storage.                                                                                             |
| Export transaction marker               | 2                         | `{schemaVersion,output}` basename ownership shape; written by `build`.                                                         |
| Verification process-owner records      | 1                         | PID/token/process-lifetime shape.                                                                                              |
| Browser module inventory                | 1                         | Exact module-path inventory shape.                                                                                             |
| Timing records and verification reports | 1                         | Timing/runner evidence shape.                                                                                                  |

The catalogue model lives in memory and is never written; the index carries
the deployment id, the revision, the base commit, and the comparison
generation's root; the review result and the change snapshot live in memory; a page embeds no
state; both sides of a comparison render from sources. The render graph holds
generations in memory; there is no private IPC format.
Lock-holder files keep their PID/token identities; do not confuse tokens,
generation hashes, event revisions or package versions with format versions.

Root configuration, `_folder.json`, YAML front matter and Markdown front matter
are strict unversioned authoring schemas: new authoring inputs, not a second
interpretation of persisted catalogue data. No stored-state converter or
fallback exists for any boundary.

## Catalogue Model

The Rust core keeps the catalogue model in memory and writes nothing.
Entries carry path-based fields for screens, pages, documents, use cases,
components and variants, including the HTML and YAML file kinds of the
[HTML screens contract](./mokly-html-screens.md). Usage records
derive their instance, slot and root regions from the composed trees under the
[comparison contract](./mokly-comparison.md) and carry no text offsets.
Resource owners exclude CSS. The read model v8 is the model's public form, and
the generated TypeScript types in the model crate are the normative shapes.

## Rejection Before Interpretation

Reject versions before reading identity, route, resource or nested payload
fields. The index reader rejects catalogue v7 and below; no manifest and no
review file is read. Unknown newer versions are invalid.

Index, detail and live descriptor readers use `MoklyVersionError` at their
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
versions. Mokly Cloud implements upload metadata v3, catalogue v8 and entry
detail v2, and reads Changes from the index.

## Acceptance

Test every version boundary with an earlier number and an unknown newer
number. Confirm rejection precedes getters for identity/path
fields. Update index, detail, live, static, upload and browser fixtures together. Keep old-version fixtures only as rejection tests.
Verify unavailable Changes with a base whose sources fail current validation,
and moved comparisons and removed previews with a base rendered from Git.
