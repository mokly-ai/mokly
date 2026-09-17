/** Existing shell presentation supplied by the private local adapter capability. */
import type { ComponentViewRecord } from "../components/manifest_types.js";

import { localPresentation } from "./same_origin_adapter.js";

export interface HighlightFrame {
  frame: HTMLIFrameElement;
  path: string;
  usage: ComponentViewRecord;
}
export function installComponentHighlight(
  root: HTMLElement,
  frames: readonly HighlightFrame[],
  selected: string | undefined,
  label: (key: string) => string,
  select: (key: string, viewport: "mobile" | "desktop") => void,
  exit: () => void,
): () => void {
  return localPresentation(root, frames, selected, label, select, exit);
}
