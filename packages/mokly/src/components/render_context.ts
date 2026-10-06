import { createContext } from "react";

import type { ComponentCollector, OwnershipScope } from "./collector.js";

export interface ComponentScope extends OwnershipScope {
  collector: ComponentCollector;
}

/** Kept inside the single consumer React graph along with its wrappers. */
export const ComponentContext = createContext<ComponentScope | null>(null);
