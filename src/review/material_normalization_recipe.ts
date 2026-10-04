/** Replay original marker edits over recipes without constructing material strings. */
import type {
  MaterialPiece,
  MaterialRecipe,
  SourceSpan,
} from "../components/material_recipe.js";

import type { PageAnalysis } from "./page_analysis.js";

type Marker = SourceSpan & {
  boundary: "component" | "header" | "start" | "end" | "signal";
  id: string;
};
export type NormalizationPiece = MaterialPiece & { marker?: Marker };

export function normalizationPieces(
  page: PageAnalysis,
  recipe: MaterialRecipe,
): readonly NormalizationPiece[] | undefined {
  const markers: Marker[] = [
    ...page.componentMarkers.map((span) => ({
      ...span,
      boundary: "component" as const,
      id: "",
    })),
    ...page.regions.flatMap(({ id, start, end }) => [
      {
        start: start - "<!--mokly-review-ignore:start:-->".length - id.length,
        end: start,
        boundary: "start" as const,
        id,
      },
      {
        start: end,
        end: end + "<!--mokly-review-ignore:end:-->".length + id.length,
        boundary: "end" as const,
        id,
      },
    ]),
    ...page.materialSignals.map((span) => ({
      ...span,
      boundary: "signal" as const,
    })),
    ...(page.headerEnd
      ? [{ start: 0, end: page.headerEnd, boundary: "header" as const, id: "" }]
      : []),
  ].sort((a, b) => a.start - b.start);
  const result: NormalizationPiece[] = [];
  for (const piece of recipe) {
    if (piece.kind === "insert") {
      result.push(piece);
      continue;
    }
    let cursor = piece.start;
    let low = 0;
    let high = markers.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (markers[middle]!.end <= cursor) low = middle + 1;
      else high = middle;
    }
    for (
      let index = low;
      index < markers.length && markers[index]!.start < piece.end;
      index++
    ) {
      const marker = markers[index]!;
      if (marker.start < cursor || marker.end > piece.end) return;
      if (cursor < marker.start)
        result.push({ ...piece, start: cursor, end: marker.start });
      if (marker.boundary !== "component")
        result.push({ ...piece, start: marker.start, end: marker.end, marker });
      cursor = marker.end;
    }
    if (cursor < piece.end) result.push({ ...piece, start: cursor });
  }
  return result;
}

export function normalizationIdentity(pieces: readonly NormalizationPiece[]) {
  const regions = new Set<string>();
  const signals = new Set<string>();
  let open: string | undefined;
  for (const { marker } of pieces) {
    if (!marker) continue;
    const { boundary, id } = marker;
    if (boundary === "start") {
      if (open || regions.has(id)) return;
      open = id;
    } else if (boundary === "end") {
      if (open !== id) return;
      regions.add(id);
      open = undefined;
    } else if (boundary === "signal") {
      if (open || signals.has(id)) return;
      signals.add(id);
    }
  }
  if (open || [...signals].some((id) => !regions.has(id))) return;
  return { regions, signals };
}

export function normalizedRecipe(
  pieces: readonly NormalizationPiece[],
  ignored: ReadonlySet<string> = new Set(),
  removedSignals: ReadonlySet<string> = new Set(),
  contract: readonly string[] = [],
): MaterialRecipe {
  const result: MaterialPiece[] = [];
  let suppress = false;
  let first = true;
  for (const piece of pieces) {
    const marker = piece.marker;
    if (marker?.boundary === "start") {
      suppress = ignored.has(marker.id);
      if (suppress)
        result.push(insert(`<!--mokly-review-ignore:${marker.id}-->`));
    } else if (marker?.boundary === "end") suppress = false;
    else if (
      !suppress &&
      !(first && marker?.boundary === "header") &&
      !(marker?.boundary === "signal" && removedSignals.has(marker.id))
    )
      result.push(piece);
    if (
      piece.kind === "source"
        ? piece.start !== piece.end
        : piece.text.length > 0
    )
      first = false;
  }
  if (contract.length)
    result.push(
      insert(`<!--mokly-review-ignore-contract:${contract.join(",")}-->`),
    );
  return result;
}

function insert(text: string): MaterialPiece {
  return { kind: "insert", text, references: [], verbatim: true };
}
