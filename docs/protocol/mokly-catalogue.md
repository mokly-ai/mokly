# Public Catalogue Read Model

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

## Supported Formats

| Boundary                  | Version                                      |
| ------------------------- | -------------------------------------------- |
| Catalogue model           | none: it lives in memory, nothing is written |
| Public catalogue index    | 7                                            |
| Entry detail              | 1                                            |
| Review result             | 8                                            |
| Catalogue change snapshot | 4                                            |

Both catalogue kinds, with and without registered components, use the same
numbers, with globally unique entry paths. Nothing is written: the catalogue
renders from sources into a bounded render cache, usage derives
from the composed trees, and the private catalogue change snapshot pairs
review v8 with the base commit, as the
[format inventory](./mokly-format-versions.md) states. The
[shell delivery contract](./mokly-shell-delivery.md) delivers the read model
as the catalogue index v7, which carries no per-view usage or resource
evidence, plus one entry detail v1 per entry. Removed page preview metadata
is v3. No entry carries a derived file name. Accepted move pairs carry
`previousPath` in review records and in the read model.

## Location And Types

Serve answers GET and HEAD `/mokly-viewer/index.json` and
`/mokly-viewer/entries/<entry path>.json` with
`application/json; charset=utf-8`, and `build` writes the same paths under
its output directory; the
[shell delivery contract](./mokly-shell-delivery.md#routes) owns the routes.
Component value types follow the
[component records](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts; the prop schema follows the
[entry props contract](./mokly-entry-props.md). The viewer exports these
types without a CLI dependency.

```ts
import type {
  ComponentControl,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  ComponentWireProps,
  PropSchema, // a JSON Schema object under the entry props profile
} from "@mokly/viewer";

type Viewport = "mobile" | "desktop";
type ColorScheme = "light" | "dark";
type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
type ChangeKind = "added" | "changed" | "removed" | "unmodified";
type PublicPath = string;

interface CatalogueReadModel {
  schemaVersion: 7;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: number; // one counter per Serve state, from 1; 0 in a build
  base?: string; // the Changes base ref when Changes is configured
  live?: { generation: string }; // Serve only: the render generation
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
  | { status: "preparing" | "pending" | "unavailable" | "disabled" };
interface CatalogueDetails {
  description: string;
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
}
interface CatalogueEntry {
  path: string;
  previousPath?: string;
  title: string;
  tags: readonly string[];
  details: CatalogueDetails;
  changes: CatalogueChanges;
}
// Usage and resource evidence travel in the entry detail of the shell
// delivery contract, not in the index.
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
  comparison: ComparisonSelection;
  documentKey: string; // the document node's input hash in the render graph
}
interface CatalogueScreen extends CatalogueEntry {
  kind: "screen";
  address?: string;
  variantOf?: string; // Present exactly on variant screens; the parent path.
  colorSchemes: readonly ColorScheme[];
  propSchema: PropSchema;
  props: ComponentWireProps; // the entry's own props, or a variant's merged props
  controls: Readonly<Record<string, ComponentControl>>;
  views: readonly CatalogueView[];
  useCasePaths: readonly string[];
}
interface CataloguePage extends CatalogueEntry {
  kind: "page";
  documentKey: string;
}
interface CatalogueDocument extends CatalogueEntry {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
  documentKeys: readonly { colorScheme: ColorScheme; documentKey: string }[];
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
  variantOf?: string; // Present exactly on variant entries; the parent path.
  colorSchemes: readonly ColorScheme[];
  propSchema: PropSchema;
  props: ComponentWireProps; // the entry's own props, or a variant's merged props
  slots: readonly string[];
  suppliedSlots: readonly string[]; // empty on a parent
  controls: Readonly<Record<string, ComponentControl>>;
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}
type CatalogueComponentVariant = CatalogueComponent & { variantOf: string };
```

No entry record carries a derived route or file name. Resource evidence names
only rendered-resource paths. A reader uses the
[artifact path contract](./mokly-artifact-paths.md): a current view is served
at `static/mokly-generated/<view route>`, a current page or document at
`static/mokly-generated/<document route>`, and the shell at `/view/<path>/`. Removed entries
have no current files; their historical documents come only from their
`preview` descriptor. `PublicPath` is an artifact-root-relative POSIX file path,
without a leading slash, origin, query or hash; resolve it against the source's
origin root, not the JSON directory or host app URL. A current component parent
has its own views, rendered from its own props, and its page shows them first. `previousPath` is
present exactly on entries the
[move contract](./mokly-moves.md) paired with an entry of the base commit.

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

The [projection contract](./mokly-catalogue-delivery.md#projection-and-privacy)
owns the allowlist, evidence, source metadata and removed-entry rules.

## Serialization, Identity And Versions

The [serialization contract](./mokly-catalogue-serialization.md) defines canonical
bytes, historical snapshot identities, deployment identity and reader versions.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[catalogue fetch contract](./mokly-catalogue-fetch.md).
