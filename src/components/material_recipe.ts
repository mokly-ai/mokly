/** Source provenance of a string material, without a second HTML coordinate space. */
import type { ComponentViewRecord } from "@mokly/viewer";

import {
  inlineMaterialReferences,
  type InlineMaterialProjection,
} from "../review/css/inline_rendering.js";

import { sameOwner, stripComponentMarkers } from "./comparison_material.js";
import type { RenderedRange } from "./ranges.js";

export interface SourceSpan {
  start: number;
  end: number;
}
export type MaterialPiece =
  | (SourceSpan & { kind: "source"; copy?: SourceSpan })
  | { kind: "insert"; text: string; references: readonly string[] };
export type MaterialRecipe = readonly MaterialPiece[];

export function materialRecipe(
  source: string,
  inline: InlineMaterialProjection,
  usage?: ComponentViewRecord,
  ranges: readonly RenderedRange[] = [],
  pairs?: ReadonlyMap<string, string>,
): MaterialRecipe {
  const recipe: MaterialPiece[] = [];
  const render = (start: number, end: number, copy?: SourceSpan) => {
    const replacements = [...inline.replacements];
    if (pairs)
      for (const range of ranges) {
        if (range.record.target.kind !== "instance") continue;
        const key = range.record.target.instanceKey;
        const componentId = pairs.get(key);
        if (componentId)
          replacements.push({
            start: range.start,
            end: range.end,
            text: `<!--mokly-owned:${componentId}:${key}-->`,
          });
      }
    replacements.sort(
      (left, right) => left.start - right.start || right.end - left.end,
    );
    let cursor = start;
    const keep = (end: number) => {
      if (end > cursor)
        recipe.push({
          kind: "source",
          start: cursor,
          end,
          ...(copy ? { copy } : {}),
        });
    };
    for (const replacement of replacements) {
      if (replacement.start < cursor || replacement.end > end) continue;
      keep(replacement.start);
      recipe.push({ kind: "insert", text: replacement.text, references: [] });
      cursor = replacement.end;
    }
    keep(end);
  };
  render(0, source.length);
  if (pairs && usage)
    for (const { slot, range } of callerSlotRanges(usage, ranges)) {
      recipe.push({
        kind: "insert",
        text: `<mokly-caller-slot data-key="${slot.key}" data-rendered="${Boolean(range)}">`,
        references: [],
      });
      if (range)
        render(range.contentStart, range.contentEnd, {
          start: range.contentStart,
          end: range.contentEnd,
        });
      recipe.push({
        kind: "insert",
        text: "</mokly-caller-slot>",
        references: [],
      });
    }
  recipe.push({
    kind: "insert",
    text: inline.appendix,
    references: inlineMaterialReferences(inline),
  });
  return recipe;
}

export function callerSlotRanges(
  usage: ComponentViewRecord,
  ranges: readonly RenderedRange[],
) {
  return usage.slots
    .filter(
      (slot) => sameOwner(slot.owner, { kind: "entry" }) && !slot.sourceSlotKey,
    )
    .map((slot) => {
      const keys = new Set([slot.key]);
      for (let size = -1; size !== keys.size;) {
        size = keys.size;
        for (const candidate of usage.slots)
          if (candidate.sourceSlotKey && keys.has(candidate.sourceSlotKey))
            keys.add(candidate.key);
      }
      return {
        slot,
        range: ranges.find(
          (range) =>
            range.record.target.kind === "slot" &&
            keys.has(range.record.target.slotKey),
        ),
      };
    });
}

export function renderMaterialRecipe(
  source: string,
  recipe: MaterialRecipe,
): string {
  return stripComponentMarkers(
    recipe
      .map((piece) =>
        piece.kind === "source"
          ? source.slice(piece.start, piece.end)
          : piece.text,
      )
      .join(""),
  );
}
