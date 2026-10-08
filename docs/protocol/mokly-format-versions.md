# Combined Path And Output Format Versions

## Delivery Status

This is the implemented contract for
[path identity in one generated tree](./mokly-path-output-integration.md).
One format number denotes one shape and interpretation. Readers accept only
the current shape; checking older data is not a content compatibility reader.

## Version Inventory

| Boundary                                | Combined version          | Reason and reader                                                                                                                   |
| --------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Private generated manifest              | 10                        | Path entries/folders, closure/blob inventory, root ranges and inserted-link provenance; both validators require the combined shape. |
| Public complete/scoped catalogue        | 6                         | Paths, documents, moves, branch-point data and view/page resource evidence; public/scoped readers require 6.                        |
| Review result                           | 7                         | Path-keyed evidence with per-rule identities, changed components and page matches; producers and decoders require 7.                |
| Static delivery descriptor              | 5                         | Path/index canonical URLs and current namespace; the nonthrowing classifier requires 5.                                             |
| Shell bootstrap envelope                | 2                         | Required version plus path-based view, catalogue v6 or external reference, and delivery v5.                                         |
| Private live capability descriptor      | 2                         | Path-keyed workspace/request identities under the current viewer contract; live readers require 2.                                  |
| Inspector wire envelope                 | 2                         | Navigation carries `screenPath` instead of `id`; both peers require 2 before message fields.                                        |
| Live catalogue index                    | `live-index-2`            | Path entries and folders, with source-only metadata and no rendered usage.                                                          |
| Catalogue change snapshot               | 3                         | Current private path/move/removal evidence paired with review v7 and v10 baselines.                                                 |
| Removed page/document preview metadata  | 3                         | Preserve the incoming `{schemaVersion,baseRef,baseCommit,path}` shape; readers derive resource paths from the current delivery.     |
| Export ownership                        | 3                         | Existing exact `{path,sha256,size}` inventory, bounds and current namespace; shape is unchanged.                                    |
| Upload metadata                         | 2                         | Existing strict envelope and `mokly-viewer/` comparison namespace; shape is unchanged.                                              |
| Plan response/exchange                  | 1                         | Content-delta fields, expiry and digest accounting are unchanged.                                                                   |
| Baseline completion marker              | 2                         | Requires manifest 10, `generated-v10` layout and historical catalogue root; the two schema-1 shapes are not reused.                 |
| Accepted output snapshot                | 1                         | New explicit version, immutable `routes` only; reject the unversioned disk/orphan shape.                                            |
| Navigation disclosure storage           | `mokly:nav-disclosure:v4` | Preserve incoming path-keyed folder/variant storage; no key migration.                                                              |
| Export transaction marker               | 2                         | Existing `{schemaVersion,output}` basename ownership shape is unchanged.                                                            |
| Verification process-owner records      | 1                         | PID/token/process-lifetime shape is unchanged.                                                                                      |
| Browser module inventory                | 1                         | Exact module-path inventory shape is unchanged.                                                                                     |
| Timing records and verification reports | 1                         | Timing/runner evidence shape is unchanged.                                                                                          |

The cache `inputs.json` stays its existing validated repository-relative path
string. Lock-holder files keep their current PID/token identities and schema;
do not confuse their tokens, generation hashes, event revisions or package
versions with format versions. Render capability tokens and private process
messages are bound to the current generation and descriptor/index versions.
Their existing nonce, limits and exact-field checks remain.

Root configuration, `_folder.json` and Markdown front matter remain the incoming
strict unversioned authoring schemas. They are new authoring inputs, not a
second interpretation of persisted catalogue data. One-shot Browse recovery
retains its current shape and strict required fields; disclosure keys follow v4.
No stored-state converter or fallback is added.

## Manifest V10

```ts
interface ManifestV10 {
  schemaVersion: 10;
  generatedBy: "mokly";
  entries: readonly ManifestEntry[];
  folders: readonly ManifestFolder[];
  sourceFiles: readonly string[];
  assetClosure: readonly string[];
  generatedFiles: readonly { path: string; blobHash: string }[];
  blobHashAlgorithm: "sha1" | "sha256";
}
```

Keep all incoming path-based entry/folder fields and validators, including
Markdown resources and variants. Require component saved-view root ranges and
private inserted-link provenance on every usage record. Resource owners exclude
CSS. Ready public view/page evidence keeps per-rule identities, changed component
paths and page selectors. Retired source dependency fields remain absent.
Keep the existing exact-byte Git blob hash,
sorted inventories, source/closure separation and manifest self-exclusion.
The `Manifest` and `HistoricalManifest` aliases name v10 only. Do not export a
v9 content reader or cast released v9 output into this shape.

## Rejection Before Interpretation

Reject versions before reading identity, route, resource or nested payload
fields. Public catalogue v5 and below are unsupported by the v6 reader;
manifest v9 and below are earlier output, not current metadata. Review
v6 and below are unsupported comparison results. Unknown newer versions remain
invalid/unsupported, never the graceful earlier-baseline result.

Use the existing typed viewer version boundary and product copy. Delivery stays
a `valid`/`unsupported-version`/`invalid` classifier; only browser boundary
readers throw `MoklyVersionError`. Export maps invalid/unsupported delivery to
its existing `export-invalid` context. Inspector peers reject a mismatched wire
version before processing navigation. No field renaming or path conversion
rescues an unsupported payload.

A schema-v10 manifest must also pass the complete combined validator. Missing
root ranges or inserted-link provenance, CSS owner records and removed fields
are invalid data, including v10 output from a writer with a different shape.
Invalid current data keeps the normal invalid-baseline path; it does not become
the graceful earlier-version outcome.

Older receivers retain HTTP 426 handling with no Blob/Complete request or
downgrade. Ownership/upload versions are unchanged because their own fields and
namespace are unchanged; catalogue/review readers independently enforce their
new payload versions. The Cloud follow-up must adopt catalogue v6, review v7,
delivery v5, bootstrap v2 and inspector v2 in addition to upload v2/ownership v3.

Cache marker v1, 0.14.0 marker v2 with manifest 9 or `generated-v9`,
invalid/truncated markers and incomplete output are partial entries, removed
under their own lock before rebuilding. Validate marker v2 with manifest 10
and `generated-v10`,
then compare settings, then validate v10 output. A complete valid marker with
different settings keeps the exact fail-intact error. Retention remains a
metadata-only check; it never hashes output. Publish completion atomically.
No earlier-format build or incompatibility outcome is cached.

## Acceptance

Test every changed version boundary with released earlier formats and an unknown
newer version. Confirm rejection precedes getters for identity/path fields.
Update complete/scoped, static/live, packed-consumer, upload and browser fixtures
together. Keep old-version fixtures only as rejection tests. Test private route
snapshot and index IPC rejection independently of public catalogue rejection.
Verify metadata v3 previews and unchanged ownership/upload/Plan formats still
round-trip without changing their fields or loosening their validators.

Verify the exact earlier-version line, successful current output and unavailable
Changes with a pinned base whose own recipe writes main's released v9 manifest, including `declaredDependencies`.
A separate complete combined-v10 base proves moved comparisons and historical
files. A schema-v10 base missing required combined proof must remain invalid.
