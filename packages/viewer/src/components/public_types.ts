/** Published compatibility types. Shell entries use the generated catalogue records. */

import type {
  CatalogueComponent,
  CatalogueDetails,
  ColorScheme,
  ComponentControl,
  PropSchema,
} from "@mokly/model";

import type { ComponentWireProps } from "./prop_types.js";
import type { ComponentViewRecord } from "./view_types.js";

/** Component metadata accepted by existing hosts. */
export interface ComponentMetadata extends Omit<
  CatalogueDetails,
  "relatedDocs"
> {
  relatedDocs: readonly string[];
  path: string;
  title: string;
  kind: CatalogueComponent["kind"];
  movedFrom?: string;
  colorSchemes: readonly ColorScheme[];
  tags?: readonly string[];
  propSchema: PropSchema;
  props: ComponentWireProps;
  controls: Readonly<Record<string, ComponentControl>>;
  slots: readonly string[];
  suppliedSlots: readonly string[];
  componentViews?: readonly ComponentViewRecord[];
  variantOf?: string;
}

/** Component metadata with a required parent path. */
export type ComponentVariantMetadata = ComponentMetadata & {
  variantOf: string;
};

/** The original type-only variant predicate exposed to hosts. */
export declare function isComponentVariantMetadata(
  entry: ComponentMetadata,
): entry is ComponentVariantMetadata;
