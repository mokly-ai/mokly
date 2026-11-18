import type {
  ColorScheme,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentSlotRecord,
  PropSchema,
} from "@mokly/model";

export type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentRangeRecord,
  ComponentRangeTarget,
  ComponentSlotRecord,
  ComponentSourceLocation,
} from "@mokly/model";

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
