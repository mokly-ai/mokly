import type { ColorScheme, Viewport } from "../data/axes.js";
import type { ManifestEntryBase } from "../registry/types.js";

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
  viewport: Viewport;
  colorScheme: ColorScheme;
  instances: readonly ComponentInstanceRecord[];
  slots: readonly ComponentSlotRecord[];
  ranges: readonly ComponentRangeRecord[];
  styles: readonly ComponentStyleOwnership[];
  resources: readonly ComponentResourceOwnership[];
}
export interface ManifestComponentVariant {
  id: string;
  title: string;
  description?: string;
  props: ComponentWireProps;
  suppliedSlots: readonly string[];
  fragments: Record<Viewport, string>;
  darkFragments?: Record<Viewport, string>;
  componentViews: readonly ComponentViewRecord[];
}
export interface ManifestComponent extends Omit<ManifestEntryBase, "kind"> {
  declaredDependencies: readonly string[];
  kind: "component";
  route: string;
  viewports: readonly ["mobile", "desktop"];
  tags?: readonly string[];
  propSchema: ObjectPropSchema;
  slots: readonly string[];
  controls: Readonly<Record<string, ComponentControl>>;
  ownedDependencies: readonly string[];
  variants: readonly ManifestComponentVariant[];
}
