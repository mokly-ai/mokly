import {
  COMPONENT_PAGES,
  CONTROLS_PAGES,
  INSPECTION_PAGES,
} from "../components/parts/destinations.js";
import { DESTINATIONS } from "../parts/destinations.js";

export const text = { schema: { kind: "string" } } as const;
export const optionalText = { ...text, optional: true } as const;
export const flag = { schema: { kind: "boolean" } } as const;
export const optionalFlag = { ...flag, optional: true } as const;
export const destination = {
  schema: {
    kind: "enum",
    values: [
      ...Object.values(DESTINATIONS),
      ...Object.values(COMPONENT_PAGES),
      ...Object.values(CONTROLS_PAGES),
      ...Object.values(INSPECTION_PAGES),
    ],
  },
  optional: true,
} as const;
export const comparisonMode = {
  schema: {
    kind: "enum",
    values: ["current", "side-by-side", "overlay", "difference"],
  },
} as const;
export const changeStatus = {
  schema: {
    kind: "enum",
    values: ["unmodified", "added", "changed", "removed"],
  },
} as const;
export const previewViewport = {
  schema: { kind: "enum", values: ["mobile", "desktop", "both"] },
} as const;
export const comparisonDestinations = {
  schema: {
    kind: "object",
    properties: {
      current: destination,
      "side-by-side": destination,
      overlay: destination,
      difference: destination,
    },
  },
} as const;
export const tagRecords = {
  schema: {
    kind: "array",
    items: {
      kind: "object",
      properties: { id: text, label: text, destination },
    },
  },
} as const;
