import type { PropSchema, SchemaProps, SlotProps } from "@mokly/mokly";

import {
  COMPONENT_PAGES,
  CONTROLS_PAGES,
  INSPECTION_PAGES,
  LIMIT_PAGES,
} from "../components/parts/destinations.js";
import { DESTINATIONS } from "../parts/destinations.js";

/** The data and slot props that a library component's view receives. */
export type LibraryProps<
  S extends PropSchema,
  Names extends readonly string[] = readonly [],
> = SchemaProps<S> & SlotProps<Names>;

/** The options of a select control for every value of an `enum` schema. */
export function enumOptions<const V extends string>(schema: {
  readonly enum: readonly V[];
}) {
  return schema.enum.map((value) => ({ label: value, value }));
}

export const text = { type: "string" } as const;
export const flag = { type: "boolean" } as const;
export const destination = {
  enum: [
    ...new Set([
      ...Object.values(DESTINATIONS),
      ...Object.values(COMPONENT_PAGES),
      ...Object.values(CONTROLS_PAGES),
      ...Object.values(INSPECTION_PAGES),
      ...Object.values(LIMIT_PAGES),
    ]),
  ],
} as const;
export const comparisonMode = {
  enum: ["current", "side-by-side", "overlay", "difference"],
} as const;
export const changeStatus = {
  enum: ["unmodified", "added", "changed", "removed"],
} as const;
export const previewViewport = {
  enum: ["mobile", "desktop", "both"],
} as const;
export const comparisonDestinations = {
  type: "object",
  additionalProperties: false,
  properties: {
    current: destination,
    "side-by-side": destination,
    overlay: destination,
    difference: destination,
  },
} as const;
export const tagRecords = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["id", "label"],
    properties: { id: text, label: text, destination },
  },
} as const;
