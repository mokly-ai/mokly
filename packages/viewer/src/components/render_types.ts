/** The private Serve render route of the controls contract; never catalogue data. */

import type { CatalogueUsage } from "../catalogue/types.js";
import type { ColorScheme, Viewport } from "../data/axes.js";

import type { ComponentWireProps, PropValue } from "./prop_types.js";

/** One temporary edit: a JSON value under the schema, or an unset optional. */
export type ComponentOverride =
  { kind: "set"; value: PropValue } | { kind: "unset" };

/** One live render of a screen, a component, or a variant of either. */
export interface ComponentRenderRequest {
  entryPath: string;
  viewport: Viewport;
  colorScheme: ColorScheme;
  /** The index revision the shell installed. */
  revision: number;
  pageId: string;
  overrides: Readonly<Record<string, ComponentOverride>>;
}

/** The temporary preview of one accepted live render. */
export interface ComponentRenderSuccess {
  renderId: string;
  revision: number;
  previewUrl: string;
  /** The complete validated props. */
  props: ComponentWireProps;
  /** The rendered view's usage, status `ready`. */
  usage: Extract<CatalogueUsage, { status: "ready" }>;
}

/** The structured failures of the render route. */
export type RenderErrorCode =
  | "invalid-input"
  | "unknown-entry"
  | "stale-revision"
  | "render-failed"
  | "capacity"
  | "forbidden"
  | "too-large"
  | "method"
  | "expired";

/** The HTTP status of each render failure. */
export const renderStatus: Readonly<Record<RenderErrorCode, number>> = {
  "invalid-input": 400,
  forbidden: 403,
  "unknown-entry": 404,
  method: 405,
  "stale-revision": 409,
  expired: 410,
  "too-large": 413,
  "render-failed": 422,
  capacity: 429,
};

/**
 * A failed live render: the route's code, which the Props panel maps to its
 * own copy, and a diagnostic message that no screen shows.
 */
export class ComponentRenderError extends Error {
  constructor(
    readonly code: RenderErrorCode | "invalid-response",
    message: string,
  ) {
    super(message);
    this.name = "ComponentRenderError";
  }
}
