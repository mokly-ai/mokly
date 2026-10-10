/** Position-exact prefix/ending proofs without rescanning retained source pieces. */
import type { MaterialRecipe } from "../components/material_recipe.js";

interface StyleShape {
  length: number;
  ending: string;
  offsets: readonly number[];
}

export class StyleSeamOffsets {
  private readonly starts: number[] = [];
  private readonly shapes: StyleShape[] = [];
  readonly endings: readonly string[];

  constructor(source: string, skippedSources: readonly string[]) {
    for (const match of source.matchAll(/<style/gi))
      this.starts.push(match.index);
    const endings = new Map<string, readonly number[]>();
    const shapes = new Set<string>();
    for (const style of skippedSources) {
      const ending = style.slice(-12);
      let offsets = endings.get(ending);
      if (!offsets) {
        const positions: number[] = [];
        for (
          let offset = source.indexOf(ending);
          offset !== -1;
          offset = source.indexOf(ending, offset + 1)
        )
          positions.push(offset);
        endings.set(ending, (offsets = positions));
      }
      const key = `${style.length}:${ending}`;
      if (!shapes.has(key)) {
        shapes.add(key);
        this.shapes.push({ length: style.length, ending, offsets });
      }
    }
    this.endings = [...endings.keys()];
  }

  /** Align whole prefixes/endings after empty pieces and adjacent source joins are removed. */
  crossingPiece(pieces: MaterialRecipe): number | undefined {
    const positions = [0];
    for (const piece of pieces)
      positions.push(
        positions.at(-1)! +
          (piece.kind === "source"
            ? piece.end - piece.start
            : piece.text.length),
      );
    for (let index = 0; index < pieces.length; index++) {
      const piece = pieces[index]!;
      if (piece.kind !== "source") continue;
      for (
        let cursor = lowerBound(this.starts, piece.start);
        cursor < this.starts.length && this.starts[cursor]! + 6 <= piece.end;
        cursor++
      ) {
        const start = positions[index]! + this.starts[cursor]! - piece.start;
        for (const shape of this.shapes) {
          const end = start + shape.length - 12;
          const target = lowerBound(positions, end + 1) - 1;
          if (
            target <= index ||
            target >= pieces.length ||
            end + 12 > positions[target + 1]!
          )
            continue;
          const ending = pieces[target]!;
          if (ending.kind === "source") {
            const offset = ending.start + end - positions[target]!;
            if (shape.offsets[lowerBound(shape.offsets, offset)] === offset)
              return target;
          } else if (
            end + 12 === positions[target + 1] &&
            ending.text.endsWith(shape.ending)
          )
            return target;
        }
      }
    }
    return undefined;
  }
}

function lowerBound(offsets: readonly number[], start: number): number {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (offsets[middle]! < start) low = middle + 1;
    else high = middle;
  }
  return low;
}
