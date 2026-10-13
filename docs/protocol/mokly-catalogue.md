# Public Catalogue Read Model

## Delivery Status

Read model v6 is the shape the frozen TypeScript backend serves. The
[Rust rebuild plan](../../plans/rust-rebuild.md) is the approved target for read model
v7 below, which follows the source-rendered catalogue model and review v8; no reader accepts an
earlier number. `ResourceEvidence` follows the
[CSS evidence schema](./mokly-css-attribution-membership.md) with the owner
field of the [comparison contract](./mokly-comparison.md). Screens and
component parents carry `propSchema`, `props`, `controls`, and their own
`views` under the [entry props contract](./mokly-entry-props.md).

## Supported Formats

| Line                      | Generated manifest | Comparison result | Read model |
| ------------------------- | ------------------ | ----------------- | ---------- |
| Frozen TypeScript backend | 10                 | 7                 | 6          |
| Rust rebuild, approved    | none               | 8                 | 7          |

Both catalogue kinds, with and without registered components, use the same
numbers, with globally unique entry paths. On the frozen line the private
catalogue-change snapshot is v3, and the manifest stores folder records,
component variants, per-view usage, root output ranges and inserted-stylesheet
provenance. On the approved line there is no generated manifest: the catalogue renders
from sources into a bounded cache, usage derives from the composed trees, and
the snapshot is v4, as the [format inventory](./mokly-format-versions.md)
states. On the approved line the [shell delivery contract](./mokly-shell-delivery.md) delivers the read model as the catalogue index v7, which carries no per-view usage or resource evidence, plus one entry detail v1 per entry; `catalogue.json` is retired (Decision 21). Removed page preview
metadata is v3 on both lines; delivery descriptors are v5 on the frozen line only. On the frozen line, no entry carries derived file names, the generated
inventory lists exact paths, the manifest retains authored hints only, Markdown
documents and their resource copies are implemented, and current and baseline
manifest readers accept only one version; earlier output follows
[baseline compatibility](./mokly-baseline-compatibility.md). Accepted move
pairs carry `previousPath` in review records and the public read model on both
lines.

## Location And Types

Export writes `mokly-viewer/catalogue.json` at the artifact root. Serve exposes
GET/HEAD `/mokly-viewer/catalogue.json` with `application/json; charset=utf-8`.
On the approved line the [shell delivery contract](./mokly-shell-delivery.md)
owns the routes.
Component value types follow the [manifest](./mokly-component-manifest.md),
[props](./mokly-component-props.md), [controls](./mokly-component-controls.md)
and [instance](./mokly-instances.md) contracts; under v7 the prop schema
follows the [entry props contract](./mokly-entry-props.md). The viewer exports
these types without a CLI dependency.

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
  resourceEvidence?: ResourceEvidence;
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
  resourceEvidence?: ResourceEvidence;
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

The [projection contract](./mokly-catalogue-delivery.md#projection-and-privacy)
owns the allowlist, evidence, source metadata and removed-entry rules.

## Serialization, Identity And Versions

The [serialization contract](./mokly-catalogue-serialization.md) defines canonical
bytes, historical snapshot identities, deployment identity and reader versions.

## Serving The Read Model

Serve headers, revisions, comparison pointers, public paths, and the fetch
rules for cross-origin artifact hosts live in the
[catalogue fetch contract](./mokly-catalogue-fetch.md).
