import type { ComponentInputOwner, ComponentViewRecord } from "@mokly/viewer";
import { canonicalJson } from "@mokly/viewer/data";

import { normalizeHistoricalDocument } from "../review/ignore.js";

import { instanceStructure } from "./instance_structure.js";
import { validateComponentRanges, type RenderedRange } from "./ranges.js";

/** Canonicalize historical material only after its original coordinates are consumed. */
export function stripHistoricalMarkers(html: string): string {
  return stripMarkers(normalizeHistoricalDocument(html));
}

/** Validate ownership before stripping layout-neutral markers for conservative migration. */
export function stripMarkers(
  html: string,
  usage?: ComponentViewRecord,
  validatedRanges?: readonly RenderedRange[],
): string {
  if (usage && !validatedRanges) validateComponentRanges(html, usage.ranges);
  return html.replace(/<!--mokly-component:(?:start|end):r-[0-9]+-->/g, "");
}

export function structureSignals(
  view: ComponentViewRecord,
  owner: ComponentInputOwner = { kind: "entry" },
) {
  return {
    instances: view.instances
      .filter((instance) => sameOwner(instance.owner, owner))
      .map(instanceStructure),
    slots: view.slots.filter(
      (slot) => sameOwner(slot.owner, owner) && !slot.sourceSlotKey,
    ),
  };
}

export function projectOwnedMaterial(
  html: string,
  usage: ComponentViewRecord | undefined,
  pairs: ReadonlyMap<string, string>,
  styles: ReadonlySet<string>,
  validatedRanges?: readonly RenderedRange[],
  owner: ComponentInputOwner = { kind: "entry" },
  clip?: { start: number; end: number },
): string {
  if (!usage) return stripMarkers(html);
  const ranges = validatedRanges ?? validateComponentRanges(html, usage.ranges);
  const render = (start: number, end: number): string => {
    const replacements: { start: number; end: number; text: string }[] = [];
    for (const range of ranges) {
      if (
        range.start < start ||
        range.end > end ||
        range.record.target.kind !== "instance"
      )
        continue;
      const key = range.record.target.instanceKey;
      const componentId = pairs.get(key);
      if (componentId)
        replacements.push({
          start: range.start,
          end: range.end,
          text: `<!--mokly-owned:${componentId}:${key}-->`,
        });
    }
    if (clip)
      for (const range of ranges) {
        if (
          range.start < start ||
          range.end > end ||
          range.record.target.kind !== "slot"
        )
          continue;
        const slot = usage.slots.find(
          (slot) =>
            range.record.target.kind === "slot" &&
            slot.key === range.record.target.slotKey,
        );
        if (slot && !sameOwner(slot.owner, owner))
          replacements.push({
            start: range.start,
            end: range.end,
            text: `<!--mokly-external-slot:${slot.sourceSlotKey ?? slot.key}-->`,
          });
      }
    for (const style of usage.styles)
      if (
        styles.has(canonicalJson(style.componentIds)) &&
        style.startOffset >= start &&
        style.endOffset <= end
      )
        replacements.push({
          start: style.startOffset,
          end: style.endOffset,
          text: "",
        });
    replacements.sort((a, b) => a.start - b.start || b.end - a.end);
    let cursor = start;
    let result = "";
    for (const replacement of replacements) {
      if (replacement.start < cursor) continue;
      result += html.slice(cursor, replacement.start) + replacement.text;
      cursor = replacement.end;
    }
    return stripMarkers(result + html.slice(cursor, end));
  };
  const slots = usage.slots.filter(
    (slot) => sameOwner(slot.owner, owner) && !slot.sourceSlotKey,
  );
  const material = slots.map((slot) => {
    const keys = new Set([slot.key]);
    for (let size = -1; size !== keys.size;) {
      size = keys.size;
      for (const candidate of usage.slots)
        if (candidate.sourceSlotKey && keys.has(candidate.sourceSlotKey))
          keys.add(candidate.key);
    }
    const range = ranges.find(
      (range) =>
        range.record.target.kind === "slot" &&
        keys.has(range.record.target.slotKey),
    );
    return `<mokly-caller-slot data-key="${slot.key}" data-rendered="${Boolean(range)}">${range ? render(range.contentStart, range.contentEnd) : ""}</mokly-caller-slot>`;
  });
  return render(clip?.start ?? 0, clip?.end ?? html.length) + material.join("");
}
export function sameOwner(
  a: ComponentInputOwner,
  b: ComponentInputOwner,
): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
