# Catalogue Projection And Delivery

Continuation of the [public catalogue contract](./mokly-catalogue.md).

## Delivery Status

Path-based projection, root usage ranges and resource evidence are implemented.

## Projection And Privacy

Construct an explicit allowlist projection from validated manifest v8, the
validated folder records, and the accepted Changes/comparison snapshot. Do not
spread a manifest, entry, or internal evidence object into public JSON.

- Screens and component variants copy their effective `colorSchemes` and
  emit one view per effective viewport and scheme, sorted mobile/light,
  mobile/dark, desktop/light, desktop/dark; light-only fallback stays in the
  viewer. Documents copy the catalogue's `colorSchemes` and have no views.
  A current entry's comparison state is never `removed`; that state is valid
  only inside `removedEntries`.
- Pages and documents have no viewport or usage. Use cases keep ordered
  standalone-screen steps by path; reused frames add no screen uses or
  duplicate instance records.
- Component parents retain schemas, read-only control descriptions, and
  declared slot names. Current parents require at least one current variant;
  both readers retain a removed parent even when all its variants moved,
  without inventing variants. Current variants
  require a current parent. Variants follow their parent in authored order;
  the first current variant is the default. Ready usage copies only
  instances/slots/ranges with validated props and supplied slot names.
- Ready view/page `resourceEvidence` copies only the [public resource fields](./mokly-css-attribution-membership.md), including rule keys, changed component paths and page selectors. Root boundaries create no instance. Private inserted-link provenance is omitted; no match nodes, source paths or declarations enter evidence.
- Details retain authored display metadata already exposed by the inspector.
  `sourcePath`, optional invocation `source.path`, and local related-doc paths stay repository-relative metadata. They never become source-serving URLs.
  The removed `details.dependencies` field is absent.
  Source paths stay repository-relative and never serve source bytes. Matched
  `relatedDocs` use validated `mock:<path>` references to current documents
  under the [document contract](./mokly-documents.md).

Never emit `sourceFiles`, `declaredDependencies`, `ownedDependencies`,
`movedFrom`, folder `exclude` globs, resolved dependency evidence,
changed-path inventories, source graphs, Git commands, private manifest
envelopes, content digests for source inputs, style offsets
(`startOffset`/`endOffset`), style/resource ownership tables, absolute
filesystem paths, credentials, or render-capability tokens. No source bytes,
HTML, runtime React values, or source maps belong in this JSON. This privacy
rule applies recursively, including removed entries and extension fields.
`snapshotId` is a one-way digest, never a public commit, manifest, or
generation inventory. Reject private filesystem paths in path fields; display
strings and props are data.

Per-entry Changes comes from the existing entry attribution, not a count of
visual comparisons. `included` is membership in Changes; affected consumers
can have eligible comparisons while `included` is false, and a paired moved
entry is included even when unmodified. Folder visibility aggregates
descendants without extra counts. Unknown, preparing, pending and disabled
states never imply unmodified or a zero count. The
[removal rule](./mokly-catalogue-changes.md#removal-selection-and-precedence)
owns selection and path reuse. A removed record carries `folderTitles`, the baseline titles of its
folders from the top level down, as display text for breadcrumbs. Each newly
projected removed record carries an opaque `snapshotId` when real immutable
identity is available, distinguishing baseline generations and catalogues. A
removed variant carries `variantOf` and requires `parentTitle`, its baseline
parent's nonempty title. Complete and scoped readers reject missing, empty or
non-string `parentTitle` on variants, and its presence on non-variants. Parent
resolution follows the [branch-point lookup](./mokly-branch-point-lookup.md).
The optional `preview` field is the additive descriptor defined by
[removed previews](./mokly-removed-previews.md); readers tolerate its absence.
Missing baseline usage is unavailable. Projection omits a removed view's usage
when it names an unpublished component and marks it unavailable. Ready empty
arrays require proven empty usage, never a failed or incomplete render.

`comparisonUrl` is null or `__mokly/diffs/__generations/<generation>/review.json`,
pinned to this content's evidence. Resolve snapshots against that JSON response
URL. Null forbids fallback requests to `/__mokly/diffs/review.json`.
Comparison files load only on selection.

## Serialization, Identity And Versions

Canonical bytes, current-version admission and historical snapshot identities
follow [serialization](./mokly-catalogue-serialization.md). Tree validation
follows the [catalogue tree](./mokly-catalogue-tree.md).

## Serve And Fetch Rules

Atomic live revisions, immutable pointers, privacy and cross-origin fetching
follow the [fetch contract](./mokly-catalogue-fetch.md).
