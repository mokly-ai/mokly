# Public Catalogue Read Model

## Location And Types

Export writes `__mokly/catalogue.json` at the artifact root. Serve exposes
GET/HEAD `/__mokly/catalogue.json` with `application/json; charset=utf-8`.
Component value types follow the [manifest](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts. The viewer exports these types
without a CLI dependency.

The [catalogue type contract](./mokly-catalogue-types.md) defines the public
interfaces and their path parameters. Addresses use `CurrentPath`; branch-point
references use `BranchPointPath`. Readers validate stored strings before they
assign these types. JSON values and schema version 4 stay unchanged.

No record carries a route or file name. A reader uses the
[artifact path contract](./mokly-artifact-paths.md): a current view is served at
`static/<view route>`, a current page or document at `static/<document route>`,
and the shell at `/view/<path>/`. Removed entries have no current files; their
historical documents come only from their `preview` descriptor. `PublicPath` is
an artifact-root-relative POSIX file path, without a leading slash, origin,
query or hash; resolve it against the source's origin root, not the JSON
directory or host app URL. A current component parent has no views; its page
shows its first current variant. `previousPath` is present exactly on entries
the [move contract](./mokly-moves.md) paired with a baseline entry.

`identity.id` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-catalogue-v1", repoRelativeConfigPath]`, scoped to the source origin.
`mokly-catalogue-v1` is the permanent identity-hash namespace, not the read
model `schemaVersion`; changing it would change published catalogue ids.
`identity.title` is `Mokly`; host slots own branding. No account data is inferred.

## Tree

The [catalogue tree contract](./mokly-catalogue-tree.md) defines `tree`, its
folder and entry nodes, hidden folders, and how `order` and `treeOrder` order
the children each section shows.

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
- Details retain authored display metadata already exposed by the inspector.
  `details.dependencies` lists the entry's source path, declared paths, and
  for a document its resources as repository-relative display labels only.
  Source paths stay repository-relative and never serve source bytes. Matched
  `relatedDocs` use validated `mock:<path>` references to current documents
  under the [document contract](./mokly-documents.md).

Never emit `sourceFiles`, `declaredDependencies`, `ownedDependencies`,
`movedFrom`, folder `exclude` globs, resolved dependency evidence, changed-path
inventories, source graphs, Git commands, private manifest envelopes, content
digests for source inputs, style offsets (`startOffset`/`endOffset`),
style/resource ownership tables, absolute filesystem paths, credentials, or
render-capability tokens. No source bytes, HTML, runtime React values, or source
maps belong in this JSON. This privacy rule applies recursively, including
removed entries and extension fields. `snapshotId` is a one-way digest, never a
public commit, manifest, or generation inventory. Reject private filesystem
paths in path fields; display strings and props are data.

Per-entry Changes comes from the existing entry attribution, not a count of
visual comparisons. `included` is membership in Changes; affected consumers can
have eligible comparisons while `included` is false, and a paired moved entry is
included even when unmodified. Folder visibility aggregates descendants without
extra counts. Unknown, preparing, pending and disabled states never imply
unmodified or a zero count. The
[removal rule](./mokly-catalogue-changes.md#removal-selection-and-precedence)
owns selection and path reuse. A removed record carries `folderTitles`, the
baseline titles of its folders from the top level down, as display text for
breadcrumbs. Each newly projected removed record carries an opaque `snapshotId`
when real immutable identity is available, distinguishing baseline generations
and catalogues. A removed variant carries `variantOf` and requires
`parentTitle`, its baseline parent's nonempty title. Complete and scoped readers
reject missing, empty or non-string `parentTitle` on variants, and its presence
on non-variants. The optional `preview` field is the additive descriptor defined
by [removed previews](./mokly-removed-previews.md); readers tolerate its
absence. Variant parents, usage component names and the readers' `previousPath`
identity check follow the [branch-point lookup](./mokly-branch-point-lookup.md),
which never rewrites a stored name. Missing baseline usage is unavailable.
Projection omits a removed view's usage, and marks it unavailable, when a
component name in it has no destination; readers reject such a name. Ready empty
arrays require proven empty usage, never a failed or incomplete render.

`comparisonUrl` is null or `__mokly/diffs/__generations/<generation>/review.json`,
pinned to this content's evidence. Resolve snapshots against that JSON response
URL. Null forbids fallback requests to `/__mokly/diffs/review.json`.
Comparison files load only on selection.

## Serialization, Identity And Versions

The [serialization contract](./mokly-catalogue-serialization.md) defines canonical
bytes, historical snapshot identities, deployment identity and reader versions.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[catalogue fetch contract](./mokly-catalogue-fetch.md).
