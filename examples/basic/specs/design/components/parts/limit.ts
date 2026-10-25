import type { ReactNode } from "react";

import type { ComponentDesignDestination } from "./destinations.js";

/**
 * A Props-tab limit drawn on an existing component or screen page: the
 * limit's own destination, and the Props panel it opens with.
 */
export interface PropsLimit {
  design: ComponentDesignDestination;
  panel: ReactNode;
}
