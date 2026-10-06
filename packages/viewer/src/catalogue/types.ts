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

import type { BeforePath, BranchPointPath, CurrentPath } from "./path_types.js";

export type ChangesStatus =
  "preparing" | "pending" | "ready" | "unavailable" | "disabled";
export type ChangeKind = "added" | "changed" | "removed" | "unmodified";
export type PublicPath = string;
export type RemovedEntryPreview =
  { kind: "screen" } | { kind: "page" } | { kind: "document" };

/** Public v4 contract, independent of private build and comparison inventories. */
export interface CatalogueReadModel<
  Path extends string = CurrentPath,
  Before extends string = BranchPointPath,
> {
  schemaVersion: 4;
  identity: { id: string; title: string };
  deploymentId: string;
  revision: { content: number; evidence: number };
  changesStatus: ChangesStatus;
  comparisonUrl: PublicPath | null;
  tree: readonly CatalogueNode<Path>[];
  /** The top-level folder `order`, which each section applies again. */
  treeOrder?: readonly string[];
  documents: readonly CatalogueDocument<Path>[];
  screens: readonly CatalogueScreen<Path>[];
  pages: readonly CataloguePage<Path>[];
  useCases: readonly CatalogueUseCase<Path>[];
  components: readonly (
    CatalogueComponent<Path> | CatalogueComponentVariant<Path>
  )[];
  removedEntries: readonly {
    entry: CatalogueRecord<Path, Before>;
    folderTitles: readonly string[];
    /** Required exactly when the removed entry is a variant. */
    parentTitle?: string;
    snapshotId?: string;
    preview?: RemovedEntryPreview;
  }[];
}
export type CatalogueRecord<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> =
  | CatalogueScreen<Path, Reference>
  | CatalogueDocument<Path, Reference>
  | CataloguePage<Path, Reference>
  | CatalogueUseCase<Path, Reference>
  | CatalogueComponent<Path, Reference>
  | CatalogueComponentVariant<Path, Reference>;
export type CatalogueNode<Path extends string = CurrentPath> =
  | {
      kind: "folder";
      path: Path;
      title: string;
      index?: Path;
      hidden?: true;
      /** The folder record's `order`, which each section applies again. */
      order?: readonly string[];
      children: readonly CatalogueNode<Path>[];
    }
  | {
      kind: "entry";
      path: Path;
      hidden?: true;
      /** The `order` of the folder whose own page this entry is. */
      order?: readonly string[];
      children?: readonly CatalogueNode<Path>[];
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
  dependencies: readonly string[];
}
export interface CatalogueEntry<Path extends string = CurrentPath> {
  path: Path;
  title: string;
  tags: readonly string[];
  previousPath?: BeforePath<Path>;
  details: CatalogueDetails;
  changes: CatalogueChanges;
}
export type CatalogueUsage<Reference extends string = CurrentPath> =
  | {
      status: "ready";
      instances: readonly ComponentInstanceRecord<Reference>[];
      slots: readonly ComponentSlotRecord[];
      ranges: readonly ComponentRangeRecord[];
    }
  | { status: "pending" | "unavailable" };
export interface CatalogueView<Reference extends string = CurrentPath> {
  viewport: Viewport;
  colorScheme: ColorScheme;
  usage: CatalogueUsage<Reference>;
  comparison: ComparisonSelection;
}
export interface CatalogueScreen<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "screen";
  address?: string;
  colorSchemes: readonly ColorScheme[];
  views: readonly CatalogueView<Reference>[];
  useCasePaths: readonly Reference[];
  /** Parent screen path, present only when this screen is a variant. */
  variantOf?: Reference;
}
export interface CataloguePage<
  Path extends string = CurrentPath,
  _Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "page";
}
export interface CatalogueUseCase<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "use-case";
  steps: readonly {
    screenPath: Reference;
    title?: string;
    description?: string;
  }[];
}
export interface CatalogueComponent<
  Path extends string = CurrentPath,
  _Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
}
export interface CatalogueComponentVariant<
  Path extends string = CurrentPath,
  Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "component";
  colorSchemes: readonly ColorScheme[];
  variantOf: Reference;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  views: readonly CatalogueView<Reference>[];
  comparison: ComparisonSelection;
}

/** Markdown document entry, with colour schemes and no viewports. */
export interface CatalogueDocument<
  Path extends string = CurrentPath,
  _Reference extends string = Path,
> extends CatalogueEntry<Path> {
  kind: "document";
  colorSchemes: readonly ColorScheme[];
}
