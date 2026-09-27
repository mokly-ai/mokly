import type { ColorScheme } from "../data/axes.js";
import type {
  HistoricalArtifactView,
  HistoricalManifestEntryBase,
  ManifestEntryBase,
} from "../registry/types.js";

import type { ComponentControl } from "./control_types.js";
import type { ComponentWireProps, ObjectPropSchema } from "./prop_types.js";

export type ComponentInputOwner =
  { kind: "entry" } | { kind: "instance"; instanceKey: string };
export interface ComponentInstanceRecord {
  key: string;
  id: string;
  componentId: string;
  owner: ComponentInputOwner;
  slotKey?: string;
  order: number;
  props: ComponentWireProps;
  propsKey: string;
  source?: ComponentSourceLocation;
}
export interface ComponentSourceLocation {
  path: string;
  line: number;
  column: number;
}
export interface ComponentSlotRecord {
  key: string;
  instanceKey: string;
  name: string;
  owner: ComponentInputOwner;
  sourceSlotKey?: string;
}
export type ComponentRangeTarget =
  { kind: "instance"; instanceKey: string } | { kind: "slot"; slotKey: string };
export interface ComponentRangeRecord {
  id: string;
  target: ComponentRangeTarget;
  parentId?: string;
}
export interface ComponentStyleOwnership {
  startOffset: number;
  endOffset: number;
  componentIds: readonly string[];
}
export interface ComponentResourceOwnership {
  path: string;
  componentIds: readonly string[];
}
export interface ComponentViewRecord {
  viewport: "mobile" | "desktop";
  colorScheme: ColorScheme;
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
  styles: readonly ComponentStyleOwnership[];
  resources: readonly ComponentResourceOwnership[];
}

/** Saved component shape stored inside raw historical v3-v6 parent records. */
export interface LegacyManifestComponentVariant {
  id: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  fragments: Record<"mobile" | "desktop", string>;
  darkFragments?: Record<"mobile" | "desktop", string>;
  componentViews: readonly ComponentViewRecord[];
}

/** Current identity-only component parent. */
export interface ManifestComponent extends Omit<ManifestEntryBase, "kind"> {
  colorSchemes: readonly ColorScheme[];
  kind: "component";
  tags?: readonly string[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  ownedDependencies: readonly string[];
}

/** Current identity-only flattened component variant. */
export interface ManifestComponentVariant extends Omit<
  ManifestEntryBase,
  "kind"
> {
  colorSchemes: readonly ColorScheme[];
  kind: "component";
  tags?: readonly string[];
  variantOf: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  componentViews: readonly ComponentViewRecord[];
}

/** Normalized historical component parent. */
export interface HistoricalManifestComponent extends Omit<
  HistoricalManifestEntryBase,
  "kind"
> {
  colorSchemes: readonly ColorScheme[];
  kind: "component";
  tags?: readonly string[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  ownedDependencies: readonly string[];
}

/** Normalized historical flattened component variant. */
export interface HistoricalManifestComponentVariant extends Omit<
  HistoricalManifestEntryBase,
  "kind"
> {
  artifacts: readonly HistoricalArtifactView[];
  colorSchemes: readonly ColorScheme[];
  componentViews: readonly ComponentViewRecord[];
  kind: "component";
  tags?: readonly string[];
  variantOf: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
}

/** Whether a current or normalized historical component is a variant entry. */
export function isManifestComponentVariant(
  entry:
    | ManifestComponent
    | ManifestComponentVariant
    | HistoricalManifestComponent
    | HistoricalManifestComponentVariant,
): entry is ManifestComponentVariant | HistoricalManifestComponentVariant {
  return "variantOf" in entry && typeof entry.variantOf === "string";
}
