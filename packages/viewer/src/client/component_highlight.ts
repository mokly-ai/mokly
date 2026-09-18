/** Existing shell presentation supplied by the private local adapter capability. */

import { localPresentation } from "./same_origin_adapter.js";
import type { HighlightFrame } from "./same_origin_highlight.js";

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
