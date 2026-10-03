# Public Catalogue Read Model

## Delivery Status

Optional per-view/page `resourceEvidence` and root usage ranges are implemented in [M19](../../plans/remove-source-path-evidence.md#milestone-19-classify-css-by-where-its-rules-match) of the [source-path removal plan](../../plans/remove-source-path-evidence.md); screen and saved-view display is implemented in [M20](../../plans/remove-source-path-evidence.md#milestone-20-show-the-outside-component-evidence), and the whole-document page display is planned for [M20B](../../plans/remove-source-path-evidence.md#milestone-20b-show-whole-document-page-evidence).
Read model v4 changes in place. `ResourceEvidence` follows the
[CSS evidence schema](./mokly-css-attribution-membership.md).

Serve, export, repository preview, and the viewer share complete read model v4;
live pages separately embed an entry-scoped shell projection. The private
manifest rejects current/removed id collisions. [Removed previews](./mokly-removed-previews.md)
carry identity only and derive every route and view path from kind and id.

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
  tree: {
    pages: readonly CatalogueNode[];
    components: readonly CatalogueNode[];
  };
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  useCases: readonly CatalogueUseCase[];
  components: readonly (CatalogueComponent | CatalogueComponentVariant)[];
  removedEntries: readonly {
    entry: CatalogueRecord;
    snapshotId?: string;
    preview?: { kind: "screen" } | { kind: "page" };
  }[];
}
type CatalogueRecord =
  | CatalogueScreen
  | CataloguePage
  | CatalogueUseCase
  | CatalogueComponent
  | CatalogueComponentVariant;
type CatalogueNode =
  | { kind: "folder"; label: string; children: readonly CatalogueNode[] }
  | { kind: "entry"; id: string; children?: readonly CatalogueNode[] };
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
  id: string;
  title: string;
  tags: readonly string[];
  navPath: readonly string[];
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
  variantOf?: string; // Present exactly on variant screens.
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView[];
  useCaseIds: readonly string[];
}
interface CataloguePage extends CatalogueEntry {
  kind: "page";
  resourceEvidence?: ResourceEvidence;
}
interface CatalogueUseCase extends CatalogueEntry {
  kind: "use-case";
  steps: readonly { screenId: string; title?: string; description?: string }[];
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
  variantOf: string; // Present exactly on variant entries.
  colorSchemes: readonly ColorScheme[];
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}
```

Entry and view identities carry no route or file path; resource evidence names
only rendered-resource paths. A reader uses the
[artifact path contract](./mokly-artifact-paths.md): a current screen or
component variant view is served at `static/<view route>`, a current page at
`static/<route>`, and the shell at `/view/<route>`. Removed entries have
no current files; their historical documents come only from their `preview`
descriptor. `PublicPath` is an artifact-root-relative POSIX file path, without
a leading slash, origin, query or hash; resolve it against the source's origin
root, not the JSON directory or host app URL. Encode validated path segments
once for a request. A component parent has no views; its page shows its first
variant entry, which follows it in the `components` array.

`identity.id` is lowercase SHA-256 of UTF-8 JSON, without LF, for
`["mokly-catalogue-v1", repoRelativeConfigPath]`, scoped to the source origin.
`mokly-catalogue-v1` is the permanent identity-hash namespace, not the read
model `schemaVersion`; changing it would change published catalogue ids.
`identity.title` is `Mokly`; host slots own branding. No account data is inferred.

## Projection And Privacy

The [projection and privacy rules](./mokly-catalogue-delivery.md#projection-and-privacy)
define the allowlist, repository-relative metadata and private fields.

## Serialization, Identity And Versions

The [serialization contract](./mokly-catalogue-delivery.md#serialization-identity-and-versions)
defines canonical bytes, identity, version admission and the public fixture.

## Serve And Fetch Rules

The [delivery contract](./mokly-catalogue-delivery.md#serve-and-fetch-rules)
defines atomic live revisions and validated reader behavior.
