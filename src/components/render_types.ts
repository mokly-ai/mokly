/** Private Serve controls protocol; these values never enter generated metadata. */
import type { ColorScheme, Viewport } from "../authoring/types.js";

import type { ComponentViewRecord } from "./manifest_types.js";
import type {
  ComponentWirePrimitive,
  ComponentWireProps,
} from "./prop_types.js";

export type ComponentOverride =
  { kind: "set"; value: ComponentWirePrimitive } | { kind: "unset" };
export interface ComponentRenderRequest {
  componentId: string;
  variantId: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  generation: string;
  pageId: string;
  overrides: Readonly<Record<string, ComponentOverride>>;
}
export interface ComponentRenderSuccess {
  renderId: string;
  generation: string;
  previewUrl: string;
  props: ComponentWireProps;
  view: ComponentViewRecord;
}
export interface RenderCapability {
  generation: string;
  token: string;
}
export type RenderErrorCode =
  | "invalid-input"
  | "unknown-entry"
  | "stale-generation"
  | "render-failed"
  | "capacity"
  | "forbidden"
  | "too-large"
  | "method"
  | "expired"
  | "cancelled";
export class ComponentRenderError extends Error {
  constructor(
    readonly code: RenderErrorCode,
    message: string,
    /** Server-only diagnostic; never include this detail in client responses. */
    readonly detail?: string,
  ) {
    super(message);
  }
}
export const renderStatus: Readonly<Record<RenderErrorCode, number>> = {
  "invalid-input": 400,
  "unknown-entry": 404,
  "stale-generation": 409,
  "render-failed": 422,
  capacity: 429,
  forbidden: 403,
  "too-large": 413,
  method: 405,
  expired: 410,
  cancelled: 409,
};
