# Public Catalogue Read Model

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
    parentTitle?: string; // Required exactly on removed variants.
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
origin root, not the JSON directory or host app URL. A current component parent
has no views; its page shows its first current variant. `previousPath` is
present exactly on entries the
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

The complete allowlist, privacy and evidence rules are in
[Catalogue Projection And Privacy](./mokly-catalogue-projection.md).

## Serialization, Identity And Versions

The [serialization contract](./mokly-catalogue-serialization.md) defines canonical
bytes, historical snapshot identities, deployment identity and reader versions.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[catalogue fetch contract](./mokly-catalogue-fetch.md).
