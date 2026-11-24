import type { PropSchema, SchemaProps, SlotProps } from "@mokly/mokly";

import { CANVAS_PAGES } from "../canvas/parts/destinations.js";

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
export const destination = { enum: Object.values(CANVAS_PAGES) } as const;
export const changeStatus = {
  enum: ["unmodified", "added", "changed", "removed"],
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
