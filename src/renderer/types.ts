import type { ReactNode } from "react";

import type { ColorScheme, Viewport } from "@mokly/viewer";

import type { ScreenDefinition } from "../authoring/types.js";
import type { ComponentVariantDefinition } from "../components/types.js";

/** Context passed by the builder to a consumer renderer. */
export interface RenderInput {
  colorScheme: ColorScheme;
  entry: (ScreenDefinition | ComponentVariantDefinition) & { path: string };
  componentProps?: Readonly<Record<string, unknown>>;
  node: ReactNode;
  stylesheets: readonly string[];
  viewport: Viewport;
}

/** Synchronous complete-document renderer contract. */
export type Renderer = (input: RenderInput) => string;
