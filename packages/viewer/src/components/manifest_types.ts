import type { ColorScheme } from "../data/axes.js";
import type { ComponentInstanceRecord } from "../generated/catalogue/ComponentInstanceRecord.js";
import type { ComponentRangeRecord } from "../generated/catalogue/ComponentRangeRecord.js";
import type { ComponentSlotRecord } from "../generated/catalogue/ComponentSlotRecord.js";
import type { ManifestEntryBase } from "../registry/types.js";

import type { ComponentControl } from "./control_types.js";
import type { ComponentWireProps, PropSchema } from "./prop_types.js";

export type { ComponentInputOwner } from "../generated/catalogue/ComponentInputOwner.js";
export type { ComponentInstanceRecord } from "../generated/catalogue/ComponentInstanceRecord.js";
export type { ComponentRangeRecord } from "../generated/catalogue/ComponentRangeRecord.js";
export type { ComponentRangeTarget } from "../generated/catalogue/ComponentRangeTarget.js";
export type { ComponentSlotRecord } from "../generated/catalogue/ComponentSlotRecord.js";
export type { ComponentSourceLocation } from "../generated/catalogue/ComponentSourceLocation.js";
export interface ComponentStyleOwnership {
  startOffset: number;
  endOffset: number;
  componentIds: readonly string[];
}
export interface ComponentResourceOwnership {
  path: string;
  componentIds: readonly string[];
}
export interface InsertedComponentStylesheet {
  startOffset: number;
  endOffset: number;
  path: string;
  componentPaths: readonly string[];
}
export interface ComponentViewRecord {
  viewport: "mobile" | "desktop";
  colorScheme: ColorScheme;
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
  styles: readonly ComponentStyleOwnership[];
  resources: readonly ComponentResourceOwnership[];
  /** Required in persisted v10 usage; absent from public inspection and unfinished renders. */
  insertedStylesheets?: readonly InsertedComponentStylesheet[];
}

/** The schema and slots that validate one component's instances. */
export interface ComponentSchemaRecord {
  propSchema: PropSchema;
  slots: readonly string[];
}

/**
 * One component entry: a parent rendered from its own props, or a variant
 * rendered from its parent's render with merged props.
 */
export interface ManifestComponent extends Omit<ManifestEntryBase, "kind"> {
  colorSchemes: readonly ColorScheme[];
  kind: "component";
  tags?: readonly string[];
  propSchema: PropSchema;
  props: ComponentWireProps;
  controls: Readonly<Record<string, ComponentControl>>;
  slots: readonly string[];
  suppliedSlots: readonly string[];
  componentViews?: readonly ComponentViewRecord[];
  /** Parent component path, present only when this component is a variant. */
  variantOf?: string;
}

/** A component entry that varies its parent's props. */
export type ManifestComponentVariant = ManifestComponent & {
  variantOf: string;
};

/** Whether one component entry is a variant of its parent. */
export function isManifestComponentVariant(
  entry: ManifestComponent,
): entry is ManifestComponentVariant {
  return typeof entry.variantOf === "string";
}
