/**
 * Measure one comparison section: extend every viewport's range spacer to the
 * section's largest document and show each version's canvas colour on its
 * opaque surface. No frame dimension depends on the result.
 */

import { canvasColour, documentRange } from "./comparison_layer_document.js";
import type { ScrollOffset } from "./comparison_scroll_mirror.js";

/** Custom property carrying a layer document's canvas colour to its surface. */
export const CANVAS_PROPERTY = "--mbk-comparison-canvas";

/** A viewport's range spacer and the range it was last sized to. */
export interface MeasuredSpacer {
  element: HTMLElement;
  range?: ScrollOffset;
}

/** One version's document and the surface showing its canvas colour. */
export interface MeasuredLayer {
  canvas: string;
  document?: Document | undefined;
  elements: { surface: HTMLElement };
}

function paint(layer: MeasuredLayer, colour: string): void {
  if (colour === layer.canvas) return;
  layer.canvas = colour;
  if (colour) layer.elements.surface.style.setProperty(CANVAS_PROPERTY, colour);
  else layer.elements.surface.style.removeProperty(CANVAS_PROPERTY);
}

function extend(
  spacers: readonly MeasuredSpacer[],
  range: ScrollOffset,
): boolean {
  let changed = false;
  for (const spacer of spacers) {
    if (spacer.range?.x === range.x && spacer.range.y === range.y) continue;
    spacer.range = range;
    spacer.element.style.width = `calc(100% + ${range.x}px)`;
    spacer.element.style.height = `${range.y}px`;
    changed = true;
  }
  return changed;
}

/**
 * Size every spacer to the largest range of the section's documents. A new
 * spacer size can add or remove a viewport scrollbar, which resizes the
 * frames and so the documents, so the measurement repeats until it settles,
 * at most three times.
 */
export function measureSection(
  layers: Iterable<MeasuredLayer>,
  spacers: Iterable<MeasuredSpacer>,
): void {
  const measured = [...layers];
  const sized = [...spacers];
  for (let pass = 0; pass < 3; pass += 1) {
    const range = { x: 0, y: 0 };
    for (const layer of measured) {
      if (!layer.document) continue;
      const extent = documentRange(layer.document);
      range.x = Math.max(range.x, extent.x);
      range.y = Math.max(range.y, extent.y);
      paint(layer, canvasColour(layer.document));
    }
    if (!extend(sized, range)) break;
  }
}
