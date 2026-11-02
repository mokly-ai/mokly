/** The host records each frame's stage without reading package markup. */

import { createContext } from "react";
import type { RefObject } from "react";

export interface FrameLayout {
  expanded: boolean;
  stage: RefObject<HTMLDivElement | null> | undefined;
}

export const FrameStageContext = createContext<
  RefObject<HTMLDivElement | null> | undefined
>(undefined);
