/** Check only bounded windows at joins; never traverse a retained sheet's interior. */
import type {
  MaterialPiece,
  MaterialRecipe,
} from "../components/material_recipe.js";
import { timingDocumentWork } from "../diagnostics/timings.js";

const prefix = "mokly-inline-";
const radius = prefix.length - 1;

export function fingerprintAtSeam(
  source: string,
  recipe: MaterialRecipe,
): boolean {
  const pieces = recipe.filter((piece) => length(piece) > 0);
  for (let seam = 1; seam < pieces.length; seam++) {
    const left = pieces[seam - 1]!;
    const right = pieces[seam]!;
    if (
      left.kind === "source" &&
      right.kind === "source" &&
      left.end === right.start
    )
      continue;
    const before = window(source, pieces, seam - 1, -1);
    const after = window(source, pieces, seam, 1);
    timingDocumentWork()?.fingerprintSeam(before.length + after.length);
    if ((before + after).includes(prefix)) return true;
  }
  return false;
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
