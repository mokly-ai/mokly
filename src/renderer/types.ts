import type { ReactNode } from "react";

import type {
  ColorScheme,
  Viewport,
  ComponentResourceOwnership,
  ComponentStyleOwnership,
} from "@mokly/viewer";

import type { ScreenDefinition } from "../authoring/types.js";
import type { ComponentDefinition } from "../components/types.js";

/** Context passed by the builder to a consumer renderer. */
export interface RenderInput {
  colorScheme: ColorScheme;
  entry: ScreenDefinition | ComponentDefinition;
  variantId?: string;
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: Viewport;
}

/** Optional exact ownership of component-generated style/resource material. */
export interface RenderResult {
  html: string;
  styles?: readonly ComponentStyleOwnership[];
  resources?: readonly ComponentResourceOwnership[];
}

/** Synchronous complete-document renderer contract. */
export type Renderer = (input: RenderInput) => string | RenderResult;
