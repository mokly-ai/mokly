/** Check only bounded windows at joins; never traverse a retained sheet's interior. */
import type {
  MaterialPiece,
  MaterialRecipe,
} from "../components/material_recipe.js";
import { timingDocumentWork } from "../diagnostics/timings.js";

import type { MaterialMarkerOffsets } from "./material_marker_offsets.js";
import type { StyleSeamOffsets } from "./style_seam_offsets.js";

const prefix = "mokly-inline-";
const radius = prefix.length - 1;

export function fingerprintAtSeam(
  source: string,
  recipe: MaterialRecipe,
  offsets: MaterialMarkerOffsets,
  styles?: StyleSeamOffsets,
): boolean {
  const pieces = coalesced(recipe);
  const styleEnds = styles
    ? pieces.map((piece) =>
        (
          piece.kind === "source"
            ? styles.hasEnd(piece.start, piece.end)
            : styles.endings.some((ending) => piece.text.endsWith(ending))
        )
          ? 1
          : 0,
      )
    : [];
  let ends = styleEnds.reduce<number>((sum, count) => sum + count, 0);
  let styleBefore = false;
  let open = false;
  for (let index = 0; index < pieces.length; index++) {
    if (index) {
      const before = window(source, pieces, index - 1, -1);
      const after = window(source, pieces, index, 1);
      timingDocumentWork()?.fingerprintSeam(before.length + after.length);
      if (
        open ||
        crosses(before, after, prefix) ||
        crosses(before, after, "<!--mokly-")
      )
        return true;
      if (
        styles &&
        ((styleBefore && ends > 0) ||
          crosses(before.toLowerCase(), after.toLowerCase(), "<style") ||
          styles.endings.some((ending) => crosses(before, after, ending)))
      )
        return true;
    }
    const piece = pieces[index]!;
    open = piece.kind === "source" && offsets.openAfter(piece.start, piece.end);
    if (piece.kind === "source" && styles?.hasStart(piece.start, piece.end))
      styleBefore = true;
    ends -= styleEnds[index] ?? 0;
  }
  return false;
}

function crosses(before: string, after: string, needle: string): boolean {
  const window = before + after;
  for (
    let offset = window.indexOf(needle);
    offset !== -1;
    offset = window.indexOf(needle, offset + 1)
  )
    if (offset < before.length && offset + needle.length > before.length)
      return true;
  return false;
}

function coalesced(recipe: MaterialRecipe): MaterialPiece[] {
  const pieces: MaterialPiece[] = [];
  for (const piece of recipe) {
    if (!length(piece)) continue;
    const previous = pieces.at(-1);
    if (
      previous?.kind === "source" &&
      piece.kind === "source" &&
      previous.end === piece.start
    )
      pieces[pieces.length - 1] = { ...previous, end: piece.end };
    else pieces.push(piece);
  }
  return pieces;
}

function window(
  source: string,
  pieces: readonly MaterialPiece[],
  index: number,
  step: -1 | 1,
): string {
  const fragments: string[] = [];
  let remaining = radius;
  for (; remaining && index >= 0 && index < pieces.length; index += step) {
    const piece = pieces[index]!;
    const size = Math.min(remaining, length(piece));
    const start = piece.kind === "source" ? piece.start : 0;
    const end = piece.kind === "source" ? piece.end : piece.text.length;
    const text = piece.kind === "source" ? source : piece.text;
    fragments.push(
      step === 1
        ? text.slice(start, start + size)
        : text.slice(end - size, end),
    );
    remaining -= size;
  }
  return (step === -1 ? fragments.reverse() : fragments).join("");
}

function length(piece: MaterialPiece): number {
  return piece.kind === "source" ? piece.end - piece.start : piece.text.length;
}
