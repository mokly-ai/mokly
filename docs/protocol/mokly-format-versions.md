# Combined Path And Output Format Versions

## Version Inventory

| Boundary                                | Version                   | Reason and reader                                                                                                           |
| --------------------------------------- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Public catalogue index                  | 7                         | The read model without per-view usage and resource evidence; screens carry props and controls; the index reader requires 7. |
| Entry detail                            | 1                         | One entry's per-view usage, resource evidence, and workspace lists; the detail reader requires 1.                           |
| Review result                           | 8                         | Tree materiality, owner-attributed rule and resource evidence, moves; producers and decoders require 8.                     |
| Catalogue change snapshot               | 4                         | Current private path/move/removal evidence paired with review v8 and the base commit.                                       |
| Live descriptor                         | 3                         | A Serve JSON route with the render capability only; the index carries the one revision and the render generation.           |
| Inspector wire envelope                 | 2                         | Navigation carries `screenPath`; both peers require 2 before message fields.                                                |
| Removed page/document preview metadata  | 3                         | `{schemaVersion,baseRef,baseCommit,path}` shape.                                                                            |
| Export ownership                        | 3                         | Exact `{path,sha256,size}` inventory, bounds and namespace; written by `build`.                                             |
| Upload metadata                         | 2                         | Strict envelope and `mokly-viewer/` comparison namespace; Mokly Cloud implements it.                                        |
| Plan response/exchange                  | 1                         | Content-delta fields, expiry and digest accounting; Mokly Cloud implements it.                                              |
| Navigation disclosure storage           | `mokly:nav-disclosure:v4` | Path-keyed folder/variant storage.                                                                                          |
| Export transaction marker               | 2                         | `{schemaVersion,output}` basename ownership shape; written by `build`.                                                      |
| Verification process-owner records      | 1                         | PID/token/process-lifetime shape.                                                                                           |
| Browser module inventory                | 1                         | Exact module-path inventory shape.                                                                                          |
| Timing records and verification reports | 1                         | Timing/runner evidence shape.                                                                                               |

The catalogue model lives in memory and is never written; the index carries
the deployment id, the revision, and the comparison URL; a page embeds no
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
Resource owners exclude CSS. The read model v7 is the model's public form, and
the generated TypeScript types in the model crate are the normative shapes.

## Rejection Before Interpretation

Reject versions before reading identity, route, resource or nested payload
fields. The index reader rejects catalogue v6 and below; no manifest is read; the
review reader rejects review v7 and below. Unknown newer versions are invalid.

Index, detail, live descriptor and review readers use `MoklyVersionError` at their
version gates. The review gate rejects numeric versions other than 8 before
content validation; malformed current results keep the plain invalid-review
error. Inspector peers reject a mismatched wire version
before processing navigation. No field renaming or path conversion rescues an
unsupported payload.

A base commit is rendered from its sources by the current version, so no
earlier-format base exists. A base whose sources fail the current validation
makes Changes unavailable with those diagnostics, and that outcome is not
cached.

A receiver that does not support these versions answers HTTP 426, and the CLI
sends no Blob or Complete request and does not downgrade. The ownership and upload readers check their own
fields and namespace; catalogue and review readers independently
enforce their payload versions. Mokly Cloud implements catalogue v7, review v8 and entry detail v1.

## Acceptance

Test every version boundary with an earlier number and an unknown newer
number. Confirm rejection precedes getters for identity/path
fields. Update index, detail, live, static, upload and browser fixtures together. Keep old-version fixtures only as rejection tests.
Verify unavailable Changes with a base whose sources fail current validation,
and moved comparisons and removed previews with a base rendered from Git.
