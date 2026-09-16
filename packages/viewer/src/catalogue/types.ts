import type { ComponentControl } from "../components/control_types.js";
import type {
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
} from "../components/manifest_types.js";
import type {
  ComponentWireProps,
  ObjectPropSchema,
} from "../components/prop_types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

export type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
export type ChangeKind = "added" | "changed" | "removed" | "unmodified";
export type PublicPath = string;

/** Public v1 contract, independent of private build and comparison inventories. */
export interface CatalogueReadModel {
  schemaVersion: 1;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  collections: readonly CatalogueCollection[];
  tree: {
    pages: readonly CatalogueNode[];
    components: readonly CatalogueNode[];
  };
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  useCases: readonly CatalogueUseCase[];
  components: readonly CatalogueComponent[];
  removedEntries: readonly {
    entry: CatalogueRoutedEntry;
    ancestors: readonly { id: string; title: string }[];
  }[];
}
export type CatalogueRoutedEntry =
  CatalogueScreen | CataloguePage | CatalogueUseCase | CatalogueComponent;
export type CatalogueNode =
  | { kind: "collection"; id: string; children: readonly CatalogueNode[] }
  | { kind: "entry"; id: string };
export type CatalogueChanges =
  | { status: "ready"; kind: ChangeKind; included: boolean }
  | { status: Exclude<ChangesStatus, "ready"> };
export type ComparisonSelection =
  | { status: "ready"; kind: ChangeKind; eligible: boolean }
  | { status: "pending" | "unavailable" | "disabled" };
export interface CatalogueDetails {
  description: string;
  rationale?: string;
  relatedDocs: readonly string[];
  sourcePath: string;
  dependencies: readonly string[];
}
export interface CatalogueEntry {
  id: string;
  title: string;
  tags: readonly string[];
  details: CatalogueDetails;
  changes: CatalogueChanges;
}
export interface CatalogueCollection extends CatalogueEntry {
  kind: "collection";
  childIds: readonly string[];
}
export type CatalogueUsage =
  | {
      status: "ready";
      instances: readonly ComponentInstanceRecord[];
      slots: readonly ComponentSlotRecord[];
      ranges: readonly ComponentRangeRecord[];
    }
  | { status: "pending" | "unavailable" };
export interface CatalogueView {
  viewport: Viewport;
  colorScheme: ColorScheme;
  fragmentPath: PublicPath | null;
  usage: CatalogueUsage;
  comparison: ComparisonSelection;
}
export interface CatalogueScreen extends CatalogueEntry {
  kind: "screen";
  route: string;
  address?: string;
  viewports: readonly Viewport[];
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView[];
  useCaseIds: readonly string[];
}
export interface CataloguePage extends CatalogueEntry {
  kind: "page";
  route: string;
  documentPath: PublicPath | null;
}
export interface CatalogueUseCase extends CatalogueEntry {
  kind: "use-case";
  route: string;
  steps: readonly { screenId: string; title?: string; description?: string }[];
}
export interface CatalogueComponent extends CatalogueEntry {
  kind: "component";
  route: string;
  viewports: readonly Viewport[];
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  variants: readonly CatalogueVariant[];
}
export interface CatalogueVariant {
  id: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}
