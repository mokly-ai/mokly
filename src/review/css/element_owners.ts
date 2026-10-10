/** Resolve matched element offsets through validated component ownership ranges. */
import type {
  ComponentInputOwner,
  ComponentInstanceRecord,
  ComponentViewRecord,
} from "@mokly/viewer";

import type { RenderedRange } from "../../components/ranges.js";
import { documentWorkSync } from "../../diagnostics/timings.js";

/** Conservative owner of one element matched by an inline rule. */
export type InlineElementOwner =
  { kind: "entry" } | { kind: "component"; componentId: string };

/** Offset lookup over one side of a paired, normalized component view. */
export interface ElementOwnerIndex {
  ownerAt(offset: number): InlineElementOwner;
}

/** Build one side's lookup using the pairing and input-owner fallback rules. */
export function createElementOwnerIndex(input: {
  ranges: readonly RenderedRange[];
  usage: ComponentViewRecord;
  counterpart: ComponentViewRecord;
  rootComponentId?: string | undefined;
}): ElementOwnerIndex {
  return documentWorkSync("matchingMs", () => {
    const instances = new Map(
      input.usage.instances.map((instance) => [instance.key, instance]),
    );
    const counterparts = new Map(
      input.counterpart.instances.map((instance) => [instance.key, instance]),
    );
    const slots = new Map(input.usage.slots.map((slot) => [slot.key, slot]));
    const ranges = [...input.ranges].sort(
      (a, b) => a.contentStart - b.contentStart || b.contentEnd - a.contentEnd,
    );

    const resolveOwner = (
      owner: ComponentInputOwner,
      seen: ReadonlySet<string>,
    ): InlineElementOwner => {
      if (owner.kind === "entry" || seen.has(owner.instanceKey))
        return { kind: "entry" };
      const instance = instances.get(owner.instanceKey);
      if (!instance) return { kind: "entry" };
      return resolveInstance(instance, new Set([...seen, owner.instanceKey]));
    };

    const resolveInstance = (
      instance: ComponentInstanceRecord,
      seen: ReadonlySet<string>,
    ): InlineElementOwner => {
      const counterpart = counterparts.get(instance.key);
      if (!counterpart || counterpart.componentId !== instance.componentId)
        return { kind: "entry" };
      if (counterpart.propsKey !== instance.propsKey)
        return resolveOwner(instance.owner, seen);
      return instance.componentId === input.rootComponentId
        ? { kind: "entry" }
        : { kind: "component", componentId: instance.componentId };
    };

    return {
      ownerAt(offset) {
        const range = innermostRange(ranges, offset);
        if (!range) return { kind: "entry" };
        const target = range.record.target;
        if (target.kind === "root") return { kind: "entry" };
        if (target.kind === "instance") {
          const instance = instances.get(target.instanceKey);
          return instance
            ? resolveInstance(instance, new Set([instance.key]))
            : { kind: "entry" };
        }
        const slot = slots.get(target.slotKey);
        return slot ? resolveOwner(slot.owner, new Set()) : { kind: "entry" };
      },
    };
  });
}

function innermostRange(
  ranges: readonly RenderedRange[],
  offset: number,
): RenderedRange | undefined {
  let result: RenderedRange | undefined;
  for (const range of ranges) {
    if (range.contentStart > offset) break;
    if (
      offset < range.contentEnd &&
      (!result ||
        range.contentStart > result.contentStart ||
        (range.contentStart === result.contentStart &&
          range.contentEnd < result.contentEnd))
    )
      result = range;
  }
  return result;
}
