# Public Catalogue Read Model

## Delivery Status

Serve, export and viewers use path-keyed v4 with rendered documents and
[scoped bootstraps](./mokly-shell-bootstrap.md). Move detection remains planned.

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
  treeOrder?: readonly string[];
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
      hidden?: true;
      order?: readonly string[];
      children: readonly CatalogueNode[];
    }
  | {
      kind: "entry";
      path: string;
      hidden?: true;
      order?: readonly string[];
      children?: readonly CatalogueNode[];
    };
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
  declared slot names. Their variant entries follow them in authored order with
  validated wire props and supplied slot names; the first is the default, and
  ready usage copies only instances/slots/ranges.
- Details retain authored display metadata already exposed by the inspector.
  `details.dependencies` lists the entry's source path, declared paths, and
  for a document its resources as repository-relative display labels only.
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
states never imply unmodified or a zero count. Removal is keyed by path within
a kind: a baseline entry is removed only when no current entry of its kind has
its path and the move contract paired it with nothing. Readers reject a
current and removed record sharing a case-folded path; only `removedEntries` may represent
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

The [serialization contract](./mokly-catalogue-serialization.md) defines canonical
bytes, historical snapshot identities, deployment identity and reader versions.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[catalogue fetch contract](./mokly-catalogue-fetch.md).
