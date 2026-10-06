import type { ColorScheme } from "../data/axes.js";
import type { ManifestEntryBase } from "../registry/types.js";

import type { ComponentControl } from "./control_types.js";
import type { ComponentWireProps, ObjectPropSchema } from "./prop_types.js";

export type ComponentInputOwner =
  { kind: "entry" } | { kind: "instance"; instanceKey: string };
export interface ComponentInstanceRecord<Path extends string = string> {
  key: string;
  id: string;
  componentId: Path;
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
export interface ComponentStyleOwnership<Path extends string = string> {
  startOffset: number;
  endOffset: number;
  componentIds: readonly Path[];
}
export interface ComponentResourceOwnership<Path extends string = string> {
  path: string;
  componentIds: readonly Path[];
}
export interface ComponentViewRecord<Path extends string = string> {
  viewport: "mobile" | "desktop";
  colorScheme: ColorScheme;
  instances: readonly ComponentInstanceRecord<Path>[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
  styles: readonly ComponentStyleOwnership<Path>[];
  resources: readonly ComponentResourceOwnership<Path>[];
}

/** Current identity-only component parent. */
export interface ManifestComponent<
  Path extends string = string,
  _Reference extends string = Path,
> extends Omit<ManifestEntryBase<Path>, "kind"> {
  colorSchemes: readonly ColorScheme[];
  kind: "component";
  tags?: readonly string[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  ownedDependencies: readonly string[];
}

/** Current identity-only flattened component variant. */
export interface ManifestComponentVariant<
  Path extends string = string,
  Reference extends string = Path,
> extends Omit<ManifestEntryBase<Path>, "kind"> {
  colorSchemes: readonly ColorScheme[];
  kind: "component";
  tags?: readonly string[];
  variantOf: Reference;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  componentViews: readonly ComponentViewRecord<Reference>[];
}

/** Whether one current or historical-v7 component is a variant entry. */
export function isManifestComponentVariant<
  Path extends string,
  Reference extends string,
>(
  entry:
    | ManifestComponent<Path, Reference>
    | ManifestComponentVariant<Path, Reference>,
): entry is ManifestComponentVariant<Path, Reference> {
  return "variantOf" in entry && typeof entry.variantOf === "string";
}
