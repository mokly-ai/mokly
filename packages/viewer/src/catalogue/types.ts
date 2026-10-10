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
import type { ResourceEvidence } from "../review/types.js";

export type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
export type ChangeKind = "added" | "changed" | "removed" | "unmodified";
export type PublicPath = string;
export type RemovedEntryPreview =
  { kind: "screen" } | { kind: "page" } | { kind: "document" };

/** Public v6 contract, independent of private build and comparison inventories. */
export interface CatalogueReadModel {
  schemaVersion: 6;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  tree: readonly CatalogueNode[];
  /** The top-level folder `order`, which each section applies again. */
  treeOrder?: readonly string[];
  documents: readonly CatalogueDocument[];
  screens: readonly CatalogueScreen[];
  pages: readonly CataloguePage[];
  useCases: readonly CatalogueUseCase[];
  components: readonly (CatalogueComponent | CatalogueComponentVariant)[];
  removedEntries: readonly {
    entry: CatalogueRecord;
    folderTitles: readonly string[];
    /** Required exactly when the removed entry is a variant. */
    parentTitle?: string;
    snapshotId?: string;
    preview?: RemovedEntryPreview;
  }[];
}
export type CatalogueRecord =
  | CatalogueScreen
  | CatalogueDocument
  | CataloguePage
  | CatalogueUseCase
  | CatalogueComponent
  | CatalogueComponentVariant;
export type CatalogueNode =
  | {
      kind: "folder";
      path: string;
      title: string;
      index?: string;
      hidden?: true;
      /** The folder record's `order`, which each section applies again. */
      order?: readonly string[];
      children: readonly CatalogueNode[];
    }
  | {
      kind: "entry";
      path: string;
      hidden?: true;
      /** The `order` of the folder whose own page this entry is. */
      order?: readonly string[];
      children?: readonly CatalogueNode[];
    };
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
}
export interface CatalogueEntry {
  path: string;
  title: string;
  tags: readonly string[];
  previousPath?: string;
  details: CatalogueDetails;
  changes: CatalogueChanges;
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
  resourceEvidence?: ResourceEvidence;
  viewport: Viewport;
  colorScheme: ColorScheme;
  usage: CatalogueUsage;
  comparison: ComparisonSelection;
}
export interface CatalogueScreen extends CatalogueEntry {
  kind: "screen";
  address?: string;
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView[];
  useCasePaths: readonly string[];
  /** Parent screen path, present only when this screen is a variant. */
  variantOf?: string;
}
export interface CataloguePage extends CatalogueEntry {
  kind: "page";
  resourceEvidence?: ResourceEvidence;
}
export interface CatalogueUseCase extends CatalogueEntry {
  kind: "use-case";
  steps: readonly {
    screenPath: string;
    title?: string;
    description?: string;
  }[];
}
export interface CatalogueComponent extends CatalogueEntry {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}
export interface CatalogueComponentVariant extends CatalogueEntry {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  variantOf: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView[];
  comparison: ComparisonSelection;
}

/** Markdown document entry, with colour schemes and no viewports. */
export interface CatalogueDocument extends CatalogueEntry {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
}
