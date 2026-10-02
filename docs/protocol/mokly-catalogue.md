# Public Catalogue Read Model

## Delivery Status

Approved contract. Serve, export, repository preview, and the viewer currently
share read model v3, keyed by kind and id; the
[path identity plan](../../plans/path-identity.md) delivers v4, keyed by path.
The manifest stays private. Removed records follow
[removed previews](./mokly-removed-previews.md), carry identity only, and
derive every file name from their path.

## Location And Types

Export writes `__mokly/catalogue.json` at the artifact root. Serve exposes
GET/HEAD `/__mokly/catalogue.json` with `application/json; charset=utf-8`.
Component value types follow the [manifest](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts. The viewer exports these types
without a CLI dependency.

```ts
import type {
  ComponentControl,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  ComponentWireProps,
  ObjectPropSchema,
} from "@mokly/viewer";

type Viewport = "mobile" | "desktop";
type ColorScheme = "light" | "dark";
type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
type ChangeKind = "added" | "changed" | "removed" | "unmodified";
type PublicPath = string;

interface CatalogueReadModel {
  schemaVersion: 4;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  tree: readonly CatalogueNode[];
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  documents: readonly CatalogueDocument[];
  useCases: readonly CatalogueUseCase[];
  components: readonly (CatalogueComponent | CatalogueComponentVariant)[];
  removedEntries: readonly {
    entry: CatalogueRecord;
    folderTitles: readonly string[];
    snapshotId?: string;
    preview?: { kind: "screen" } | { kind: "page" } | { kind: "document" };
  }[];
}
type CatalogueRecord =
  | CatalogueScreen
  | CataloguePage
  | CatalogueDocument
  | CatalogueUseCase
  | CatalogueComponent
  | CatalogueComponentVariant;
type CatalogueNode =
  | {
      kind: "folder";
      path: string;
      title: string;
      index?: string;
      children: readonly CatalogueNode[];
    }
  | { kind: "entry"; path: string; children?: readonly CatalogueNode[] };
type CatalogueChanges =
  | { status: "ready"; kind: ChangeKind; included: boolean }
  | { status: Exclude<ChangesStatus, "ready"> };
type ComparisonSelection =
  | { status: "ready"; kind: ChangeKind; eligible: boolean }
  | { status: "pending" | "unavailable" | "disabled" };
interface CatalogueDetails {
  description: string;
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  dependencies: readonly string[];
}
interface CatalogueEntry {
  path: string;
  previousPath?: string;
  title: string;
  tags: readonly string[];
  details: CatalogueDetails;
  changes: CatalogueChanges;
}
type CatalogueUsage =
  | {
      status: "ready";
      instances: readonly ComponentInstanceRecord[];
      slots: readonly ComponentSlotRecord[];
      ranges: readonly ComponentRangeRecord[];
    }
  | { status: "pending" | "unavailable" };
interface CatalogueView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  usage: CatalogueUsage;
  comparison: ComparisonSelection;
}
interface CatalogueScreen extends CatalogueEntry {
  kind: "screen";
  address?: string;
  variantOf?: string; // Present exactly on variant screens; the parent path.
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView[];
  useCasePaths: readonly string[];
}
interface CataloguePage extends CatalogueEntry {
  kind: "page";
}
interface CatalogueDocument extends CatalogueEntry {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
}
interface CatalogueUseCase extends CatalogueEntry {
  kind: "use-case";
  steps: readonly {
    screenPath: string;
    title?: string;
    description?: string;
  }[];
}
interface CatalogueComponent extends CatalogueEntry {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}
interface CatalogueComponentVariant extends CatalogueEntry {
  kind: "component";
  variantOf: string; // Present exactly on variant entries; the parent path.
  colorSchemes: readonly ColorScheme[];
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}
```

No record carries a route or file name. A reader uses the
[artifact path contract](./mokly-artifact-paths.md): a current view is served
at `static/<view route>`, a current page or document at
`static/<document route>`, and the shell at `/view/<path>/`. Removed entries
have no current files; their historical documents come only from their
`preview` descriptor. `PublicPath` is an artifact-root-relative POSIX file path,
without a leading slash, origin, query or hash; resolve it against the source's
origin root, not the JSON directory or host app URL. A component parent has no
views; its page shows its first variant entry, which follows it in the
`components` array. `previousPath` is present exactly on entries the
[move contract](./mokly-moves.md) paired with a baseline entry.

`identity.id` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-catalogue-v1", repoRelativeConfigPath]`, scoped to the source origin.
`mokly-catalogue-v1` is the permanent identity-hash namespace, not the read
model `schemaVersion`; changing it would change published catalogue ids.
`identity.title` is `Mokly`; host slots own branding. No account data is inferred.

## Tree

`tree` is one tree for the whole catalogue. The viewer derives its two sections
from it: Components shows the nodes whose subtree contains an entry of kind
`component`, pruned to those entries; Specs shows the nodes whose subtree
contains an entry of any other kind, pruned likewise. A folder holding both
kinds therefore appears in both sections with different children.

A folder node carries its resolved [title](./mokly-folders.md#titles). Its
`index` is the path of its own page when that page is a document, page, or use
case; that entry is also the folder's first child node, so the viewer renders
it as the `Overview` row under the [row rules](./mokly-folders.md#rows-and-clicks).
A folder whose own page is a screen or component is not emitted as a folder
node: the projection emits that entry's node with `children` holding its
variants in authored order followed by the folder's other members. An entry
node otherwise has `children` exactly when it is a screen or component with
variants, holding those variants in authored order. Children of a folder node
follow the [order rule](./mokly-folders.md#order); hidden folders and their
descendants are omitted, so an entry present in an array may be absent from
the tree.

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
  declared slot names. Their variant entries follow them in authored order with
  validated wire props and supplied slot names; the first is the default, and
  ready usage copies only instances/slots/ranges.
- Details retain authored display metadata already exposed by the inspector.
  `details.dependencies` lists the entry's source path, declared paths, and
  for a document its resources as repository-relative display labels only.
  `sourcePath`, optional invocation `source.path`, and local related-doc paths
  stay repository-relative metadata. They never become source-serving URLs.

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
states never imply unmodified or a zero count. Removal is keyed by path within
a kind: a baseline entry is removed only when no current entry of its kind has
its path and the move contract paired it with nothing. Readers reject a
current and removed record sharing a path; only `removedEntries` may represent
history. A removed record carries `folderTitles`, the baseline titles of its
folders from the top level down, as display text for breadcrumbs. Each newly
projected removed record carries an opaque `snapshotId` when real immutable
identity is available, distinguishing baseline generations and catalogues. A
removed variant of either kind is an ordinary removed entry carrying
`variantOf`. The optional `preview` field is the additive descriptor defined by
[removed previews](./mokly-removed-previews.md); readers tolerate its absence.
Missing baseline usage is unavailable. The projection checks components
actually published in the model; it never publishes dangling references or
weakens reader validation. Proven empty usage is ready with empty arrays,
never inferred from a failed or incomplete render.

`comparisonUrl` is null or `__mokly/diffs/__generations/<generation>/review.json`,
pinned to this content's evidence. Resolve snapshots against that JSON response
URL. Null forbids fallback requests to `/__mokly/diffs/review.json`.
Comparison files load only on selection.

## Serialization, Identity And Versions

Sort object keys recursively by UTF-16 code units; preserve authored steps and
tags. Entry arrays sort by kind and path in UTF-16 order, yielding `component`,
`document`, `page`, `screen`, `use-case`; a parent's variants instead follow it
in authored order before the next entry. Navigation, the details `Variants`
row, and public-tree entry children use that same sibling order. Build
`removedEntries` from current and baseline entries. A removed parent appears at
its kind/path position, immediately followed by its removed variants in
baseline authored order; variants of a surviving parent occupy that current
parent's position in the same order. Only a variant without an eligible current
or removed parent falls back to kind-then-path order. Instances/slots sort by
key and ranges by DOM start order. Tree siblings follow the
[folder order rule](./mokly-folders.md#order); entry-node variant children
retain authored order. Emit required empties, omit absent optionals, use
two-space indentation and a final LF. Identical inputs produce identical bytes
regardless of enumeration, time or output location.

`snapshotId` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-historical-snapshot-v3", catalogueIdentity, sourceKind,
sourceIdentity, entryKind, entryPath]`. `sourceKind` is `baseline` when
accepted evidence names one unambiguous baseline commit; that commit is the
`sourceIdentity`. Projection requires every available evidence/comparison
baseline commit to agree. This baseline identity takes precedence even after a
live immutable comparison becomes available, so an evidence-only refresh does
not invalidate selection. When no baseline identity exists, an exact 64-hex
generation from `comparisonUrl` may supply `sourceKind: "generation"`. With
neither real source, projection omits the field instead of deriving it from
revisions, `deploymentId`, metadata, time, or randomness.

Readers validate supplied snapshot ids and require uniqueness. When the field
is absent but one immutable comparison generation is advertised, the reader
derives a generation-backed identity. Path-only selection of a removed record
normalizes to its safe identity when present. A baseline or generation change
produces different ids, so an unknown, stale, or cross-catalogue selection
fails closed rather than retargeting content.

`deploymentId` is the artifact's 64-hex identity. The
[delivery hashing rule](./mokly-export-browser.md#deployment-identity) additionally
normalizes this owned JSON's top-level `deploymentId` to 64 zeroes before hashing
and stamps it afterward, alongside shell descriptors. Other catalogue bytes
participate unchanged. Export revisions are `{ content: 0, evidence: 0 }`.

Readers require `schemaVersion: 4` and reject older and unknown versions;
writers remain allowlisted. Version 4 keys every record by path, adds
documents, folder titles, `previousPath`, and one tree, and removes `id`,
`navPath`, `useCaseIds`, `screenId`, and the per-section trees. Optional
fields are additive; removals, required additions, changed meaning, new union
discriminants or incompatible paths require a new version. This file and the
inspector asset are additive inventory entries: ownership v2 and upload v1
remain unchanged; the review result and delivery descriptor follow the
[Changes](./mokly-changes.md) and [static delivery](./mokly-export-delivery.md)
contracts.

The [public v4 fixture](./fixtures/catalogue-v4.json) ships in the npm package
and is checked by the reader/projection conformance tests.

The reader requires `tree`; `[]` is valid when the catalogue has no visible
current entries. A nonempty tree must follow the [path contract](./mokly-paths.md):
every entry node names a current entry exactly once, every folder node's
`path` is a proper prefix of each child's path, an `index` names a current
entry that is the folder's first child, no folder node is empty, and no
removed entry occurs. Entry-node `children` hold exactly the variants and
members the [tree rule](#tree) allows. Unknown fields follow the existing
reader policy for public JSON.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[catalogue fetch contract](./mokly-catalogue-fetch.md).
