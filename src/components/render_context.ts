import { createContext } from "react";

import type { ComponentCollector, OwnershipScope } from "./collector.js";
import type { ComponentRenderContext } from "./types.js";

/** Static collection scope used by the ordinary server renderer. */
export interface StaticComponentScope extends OwnershipScope {
  collector: ComponentCollector;
  kind: "static";
}

/** Browser scope that validates registered components without recording them. */
export interface InteractiveComponentScope {
  context: ComponentRenderContext;
  kind: "interactive";
}

export type ComponentScope = StaticComponentScope | InteractiveComponentScope;

/** Kept inside the single consumer React graph along with its wrappers. */
export const ComponentContext = createContext<ComponentScope | null>(null);
