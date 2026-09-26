# Public catalogue data

This module projects accepted catalogue and Changes evidence into the public
`schemaVersion: 3` read model at `__mokly/catalogue.json`. Serve, consumer export,
and repository preview use the same projection. The local shell keeps its embedded private data; Serve
evidence updates also adopt the validated public snapshot in place.

`projection_input.ts` is the typed input boundary. It accepts validated manifest
v7 or live-index metadata, the section-scoped folder trees, and accepted comparison/usage
evidence; projection performs no filesystem reads, Git commands, or rendering.
`projection.ts`, `views.ts`, and `changes.ts` select public fields explicitly.
Changes membership comes from entry and component attribution, independently
of per-view comparison eligibility. Removed entries retain baseline labels, an
opaque per-record `snapshotId` when real immutable identity is available, plus
the optional additive `preview` descriptor from the
[removed previews contract](../../docs/protocol/mokly-removed-previews.md);
uncomputed usage stays pending or unavailable.
Snapshot ids derive through the viewer-owned shared helper from the catalogue
identity, exact entry kind and id, and either the accepted baseline commit or,
only when no commit exists, an immutable comparison generation. Conflicting
baseline identities fail projection; revisions and live deployment hashes are
never substituted. Older generation-backed catalogues normalize safely, while
identity-less same-id history remains unavailable.
`CatalogueProjectionInput.removedPreviews` is caller-supplied generation data;
projection never derives it from Git or the filesystem. Page paths must name the
same 64-hex generation as `comparisonUrl` and end in the exact removed route,
while screen descriptors reuse that generation's comparison. Readers reject
descriptors on current entries, mismatched entry kinds, missing comparison URLs,
and cross-generation or mismatched page paths while accepting v3 catalogues
that omit the optional preview field.
Serve supplies only removed-screen descriptors after a complete comparison is
pinned; selected-only generations never change the public model, and live page
descriptors remain absent. Changes-enabled consumer export and repository
publication supply both screen descriptors and removed-page paths after their
historical closures are packaged. Evidence replacement publishes the pointer,
descriptors and removed-entry snapshot atomically. Current-only delivery supplies
none of them.
Historical usage also becomes unavailable when a current entry with the same id
excludes a referenced component's historical metadata. Projection checks the
retained component set once for screens and removed variants; readers remain
strict.

`@mokly/viewer` owns the public types and `readCatalogue`; its value/reference
validators reject unsupported versions, malformed known fields, private evidence,
unsafe paths, and broken references while tolerating additive fields. Component
schemas, controls, wire props, keys and ranges reuse their existing validators.
Historical props and slot names are not checked against newer component
declarations; their wire encoding, keys and ownership references remain validated.
Display strings and props remain authored data; repository-relative source
metadata never grants permission to serve source files.

`serialization.ts` writes recursively sorted object keys, two-space indentation,
and a final newline. Entry arrays sort by kind name and then id, with a
parent's variants following it in authored order; usage records have canonical
ordering; steps and tags retain their order; tree siblings use the shared
folder-first English-locale comparator. Catalogue identity
depends only on the repository-relative config path. Export stamps the complete
artifact identity; Serve hashes its canonical snapshot with the identity field
zeroed and advances content/evidence revisions on accepted updates.

The [public fixture](../../docs/protocol/fixtures/catalogue-v3.json) ships in the
npm package. Consumers need the documented JSON artifact, not a CLI deep import.
The viewer package consumes this projection without importing the CLI.

```sh
npm run build
node --import tsx --test --test-concurrency=2 tests/catalogue_*.test.ts
npx playwright test tests/browser/catalogue_fetch.spec.ts
```

See the [catalogue contract](../../docs/protocol/mokly-catalogue.md),
[export boundary](../export/README.md), and [Serve lifecycle](../server/README.md).
