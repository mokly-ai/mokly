import type { ColorScheme } from "../data/axes.js";
import type { ComponentInstanceRecord } from "../generated/catalogue/ComponentInstanceRecord.js";
import type { ComponentRangeRecord } from "../generated/catalogue/ComponentRangeRecord.js";
import type { ComponentSlotRecord } from "../generated/catalogue/ComponentSlotRecord.js";

import type { PropSchema } from "./prop_types.js";

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
  /** Optional stylesheet spans supplied by a frame adapter. */
  insertedStylesheets?: readonly InsertedComponentStylesheet[];
}

/** The schema and slots that validate one component's instances. */
export interface ComponentSchemaRecord {
  propSchema: PropSchema;
  slots: readonly string[];
}
