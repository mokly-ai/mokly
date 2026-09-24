# Public catalogue data

This module projects accepted catalogue and Changes evidence into the public
`schemaVersion: 2` read model at `__mokly/catalogue.json`. Serve, consumer export,
and repository preview use the same projection. The local shell keeps its embedded private data; Serve
evidence updates also adopt the validated public snapshot in place.

`projection_input.ts` is the typed input boundary. It accepts validated manifest
v6 or live-index metadata, the collection forest, and accepted comparison/usage
evidence; projection performs no filesystem reads, Git commands, or rendering.
`projection.ts`, `views.ts`, and `changes.ts` select public fields explicitly.
Changes membership comes from route/component attribution, independently of
per-view comparison eligibility. Removed entries retain baseline labels and
null current paths, plus the optional additive `preview` descriptor from the
[removed previews contract](../../docs/protocol/mokly-removed-previews.md);
uncomputed usage stays pending or unavailable.
`CatalogueProjectionInput.removedPreviews` is caller-supplied generation data;
projection never derives it from Git or the filesystem. Page paths must name the
same 64-hex generation as `comparisonUrl` and end in the exact removed route,
while screen descriptors reuse that generation's comparison. Readers reject
descriptors on current entries, mismatched entry kinds, missing comparison URLs,
and cross-generation or mismatched page paths while accepting older catalogues
that omit the field.
Serve supplies only removed-screen descriptors after a complete comparison is
pinned; selected-only generations never change the public model, and live page
descriptors remain absent. Changes-enabled consumer export and repository
publication supply both screen descriptors and removed-page paths after their
historical closures are packaged. Evidence replacement publishes the pointer,
descriptors and removed-entry snapshot atomically. Current-only delivery supplies
none of them.
Historical usage also becomes unavailable when current id/route precedence
omits any referenced component's metadata. Projection checks the retained
component set once for screens and removed variants; readers remain strict.

`@mokly/viewer` owns the public types and `readCatalogue`; its value/reference
validators reject unsupported versions, malformed known fields, private evidence,
unsafe paths, and broken references while tolerating additive fields. Component
schemas, controls, wire props, keys and ranges reuse their existing validators.
Historical props and slot names are not checked against newer component
declarations; their wire encoding, keys and ownership references remain validated.
Display strings and props remain authored data; repository-relative source
metadata never grants permission to serve source files.

`serialization.ts` writes recursively sorted object keys, two-space indentation,
and a final newline. Entry arrays and usage records have canonical ordering;
authored children, variants, steps and tags retain their order. Catalogue identity
depends only on the repository-relative config path. Export stamps the complete
artifact identity; Serve hashes its canonical snapshot with the identity field
zeroed and advances content/evidence revisions on accepted updates.

The public v2 fixture `docs/protocol/fixtures/catalogue-v2.json` ships in the
npm package. Consumers need the documented JSON artifact, not a CLI deep import.
The viewer package consumes this projection without importing the CLI.

The [source-path removal plan](../../plans/remove-source-path-evidence.md)
delivered private input v6 in Milestone 6 and public v2 in Milestone 7.
`details.dependencies` is absent, and the public reader rejects v1.

```sh
npm run build
node --import tsx --test --test-concurrency=2 tests/catalogue_*.test.ts
npx playwright test tests/browser/catalogue_fetch.spec.ts
```

See the [catalogue contract](../../docs/protocol/mokly-catalogue.md),
[export boundary](../export/README.md), and [Serve lifecycle](../server/README.md).
