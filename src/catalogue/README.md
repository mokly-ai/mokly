# Public catalogue data

This module projects validated manifest v8 and accepted Changes evidence into
public read model v4 at `__mokly/catalogue.json`. Serve, export and repository
preview share its explicit allowlist. Entries are keyed by path, and one tree
carries resolved folder titles, order, hidden flags, indexes and variants.
The shell labels its non-component section Specs. Documents share
the page frame and publish their effective schemes and resource dependencies.
A removed component parent remains a valid record when all its variants move
elsewhere. Current parents still require a current variant; the public and scoped
readers share that rule. Matched related-doc paths become validated `mock:<path>` references; other paths
remain source labels. Accepted comparison pairs supply `previousPath` on current
entries. Pure moves remain unmodified and included; paired baseline records
produce no removals. Plain builds do not infer or publish previous paths.
Live shell pages derive
a separate entry-scoped bootstrap from it, retaining the whole index but
replacing out-of-scope usage with the viewer runtime's `omitted` state. The
endpoint, exported file, fixture, upload and ownership inventories never contain
that state. The local shell keeps its embedded private data; Serve evidence
updates replace the validated scoped public snapshot and optional matching
private workspace together.

`projection_input.ts` is the typed input boundary. It accepts validated manifest
v8 or live-index metadata, the shared folder tree, and accepted comparison/usage
evidence; projection performs no filesystem reads, Git commands, or rendering.
`projection.ts`, `views.ts`, and `changes.ts` select public fields explicitly.
Changes membership comes from entry and component attribution, independently
of per-view comparison eligibility. Removed variants require their baseline
`parentTitle`, including when another kind reuses the parent's path. Both readers
reject missing variant titles and titles on removed non-variants. The field
survives scoped and viewer projections. Removed entries retain baseline labels, an
opaque per-record `snapshotId` when real immutable identity is available, plus
the optional additive `preview` descriptor from the
[removed previews contract](../../docs/protocol/mokly-removed-previews.md);
uncomputed usage stays pending or unavailable.
Snapshot ids derive through the viewer-owned shared helper from the catalogue
identity, exact entry kind and path, and either the accepted baseline commit or,
only when no commit exists, an immutable comparison generation. Conflicting
baseline identities fail projection; revisions and live deployment hashes are
never substituted. Generation-backed catalogues normalize safely. Readers
reject any current and removed records that share a path.
`CatalogueProjectionInput.removedPreviews` is caller-supplied generation data;
projection never derives it from Git or the filesystem. The map is keyed by
removed entry path; `previewMetadataPath(path)` names page metadata, while
screen descriptors reuse the same generation's comparison. Readers reject descriptors
on current entries, mismatched entry kinds, or missing comparison URLs while
accepting v4 catalogues that omit the optional preview field.
Serve supplies only removed-screen descriptors after a complete comparison is
pinned; selected-only generations never change the public model, and live page
descriptors remain absent. Changes-enabled consumer export and repository
publication supply both screen descriptors and removed-page paths after their
historical closures are packaged. Evidence replacement publishes the pointer,
descriptors and removed-entry snapshot atomically. Current-only delivery supplies
none of them. The shared `@mokly/viewer/data` branch-point lookup resolves each
usage component name on its record's side. A removed screen or variant keeps
usage when the component moved or changed only letter case. Stored names stay
unchanged, including case-sensitive instance ids. If a name has no component
parent destination, projection marks that usage unavailable. Both readers
reject such names in supplied usage. They also reject a previous path that a
current entry of the same kind uses, with case folding. Another kind may reuse
that path.

`@mokly/viewer` owns the public types and `readCatalogue`; its value/reference
validators reject unsupported versions, malformed known fields, private evidence,
unsafe paths, bootstrap-only `omitted` usage, and broken references while
tolerating additive fields. The runtime bootstrap reader derives scope from the
page route/snapshot, requires `omitted` exactly outside it, and fully validates
retained records. Component
schemas, controls, wire props, keys and ranges reuse their existing validators.
Historical props and slot names are not checked against newer component
declarations; their wire encoding, keys and ownership references remain validated.
Display strings and props remain authored data; repository-relative source
metadata never grants permission to serve source files.

`serialization.ts` writes recursively sorted object keys, two-space indentation,
and a final newline. Entry arrays sort by kind name and then path, with a
parent's variants following it in authored order; usage records have canonical
ordering; steps and tags retain their order; tree siblings use the shared
folder-first English-locale comparator. Catalogue identity
depends only on the repository-relative config path. Export stamps the complete
artifact identity; Serve hashes its canonical snapshot with the identity field
zeroed and advances content/evidence revisions on accepted updates.
Removed variants resolve their parent through the lookup. They occupy that
parent's kind/path position in baseline authored order, including after a move
or a case-only rename.

The [public fixture](../../docs/protocol/fixtures/catalogue-v4.json) ships in the
npm package. Consumers need the documented JSON artifact, not a CLI deep import.
The viewer package consumes this projection without importing the CLI.

```sh
npm run build
node --import tsx --test --test-concurrency=2 tests/catalogue_*.test.ts
npx playwright test tests/browser/catalogue_fetch.spec.ts
```

See the [catalogue contract](../../docs/protocol/mokly-catalogue.md),
[bootstrap contract](../../docs/protocol/mokly-shell-bootstrap.md),
[export boundary](../export/README.md), and [Serve lifecycle](../server/README.md).

Hidden folders remain explicit tree nodes. The viewer filters All/search while
Changes keeps hidden ancestry; every current entry remains present in the wire tree.
