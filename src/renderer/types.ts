import type { ReactNode } from "react";

import type {
  ColorScheme,
  Viewport,
  ComponentResourceOwnership,
  ComponentStyleOwnership,
} from "@mokly/viewer";

import type { ScreenDefinition } from "../authoring/types.js";
import type { ComponentVariantDefinition } from "../components/types.js";

/** Context passed by the builder to a consumer renderer. */
export interface RenderInput {
  colorScheme: ColorScheme;
  entry: ScreenDefinition | ComponentVariantDefinition;
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: Viewport;
}

/** Pure browser-render input used by an optional Live renderer export. */
export type InteractiveRenderInput = Omit<RenderInput, "stylesheets">;

/** Optional exact ownership of component-generated style/resource material. */
export interface RenderResult {
  html: string;
  styles?: readonly ComponentStyleOwnership[];
  resources?: readonly ComponentResourceOwnership[];
}

/** Synchronous complete-document renderer contract. */
export type Renderer = (input: RenderInput) => string | RenderResult;

/** Optional browser wrapper that mirrors the providers used by `Renderer`. */
export type InteractiveRenderer = (input: InteractiveRenderInput) => ReactNode;

/** Consumer renderer module loaded at the static and Live boundaries. */
export interface RendererModule {
  default: Renderer;
  interactive?: InteractiveRenderer;
}
