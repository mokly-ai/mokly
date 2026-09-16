import type { ComponentInputOwner, ComponentViewRecord } from "@mokly/viewer";
import { canonicalJson } from "@mokly/viewer/data";

import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../review/ignore.js";

import {
  projectOwnedMaterial,
  sameOwner,
  stripHistoricalMarkers,
  stripMarkers,
  structureSignals,
} from "./comparison_material.js";
import { validateComponentRanges, type RenderedRange } from "./ranges.js";

export interface ComponentProjection {
  before: string;
  after: string;
  inputs: boolean;
  structure: boolean;
  rawEqual: boolean;
  ignoredIds: readonly string[];
  pairedComponentIds: ReadonlySet<string>;
}

/** Project only mutually proven implementations; data and rendered slots stay with their caller. */
export function projectComponentPair(
  before: string,
  after: string,
  beforeView: ComponentViewRecord | undefined,
  afterView: ComponentViewRecord | undefined,
  context: string,
  rootComponentId?: string,
  beforeRanges?: readonly RenderedRange[],
  afterRanges?: readonly RenderedRange[],
): ComponentProjection {
  const validatedBefore = beforeView
    ? (beforeRanges ??
      validateComponentRanges(before, beforeView.ranges, "historical"))
    : undefined;
  const validatedAfter = afterView
    ? (afterRanges ?? validateComponentRanges(after, afterView.ranges))
    : undefined;
  const rawBefore = normalizeSingleDocument(
    stripHistoricalMarkers(before),
    context,
  );
  const rawAfter = normalizeSingleDocument(
    stripMarkers(after, afterView, validatedAfter),
    context,
  );
  const pairs = new Map<string, string>();
  if (beforeView && afterView) {
    const current = new Map(
      afterView.instances.map((instance) => [instance.key, instance]),
    );
    for (const instance of beforeView.instances)
      if (current.get(instance.key)?.componentId === instance.componentId)
        pairs.set(instance.key, instance.componentId);
  }
  const pairedComponentIds = new Set(pairs.values());
  const stylesBefore = styleGroups(
    beforeView,
    pairedComponentIds,
    rootComponentId,
  );
  const stylesAfter = styleGroups(
    afterView,
    pairedComponentIds,
    rootComponentId,
  );
  const pairedStyles = new Set(
    [...stylesBefore].filter((group) => stylesAfter.has(group)),
  );
  const left =
    beforeView && afterView
      ? projectOwnedMaterial(
          before,
          beforeView,
          pairs,
          pairedStyles,
          validatedBefore,
        )
      : stripMarkers(before, beforeView, validatedBefore);
  const right =
    beforeView && afterView
      ? projectOwnedMaterial(
          after,
          afterView,
          pairs,
          pairedStyles,
          validatedAfter,
        )
      : stripMarkers(after, afterView, validatedAfter);
  const normalized = normalizeReviewPair(
    stripHistoricalMarkers(left),
    right,
    context,
  );
  const currentInputs = new Map(
    afterView?.instances
      .filter((item) => item.owner.kind === "entry")
      .map((item) => [item.key, item]),
  );
  const inputs = Boolean(
    beforeView?.instances.some(
      (item) =>
        item.owner.kind === "entry" &&
        currentInputs.get(item.key)?.componentId === item.componentId &&
        currentInputs.get(item.key)?.propsKey !== item.propsKey,
    ),
  );
  const structure = Boolean(
    beforeView &&
    afterView &&
    canonicalJson(structureSignals(beforeView)) !==
      canonicalJson(structureSignals(afterView)),
  );
  return {
    before: normalized.base,
    after: normalized.head,
    inputs,
    structure,
    rawEqual: rawBefore === rawAfter,
    ignoredIds: normalized.ignoredIds,
    pairedComponentIds,
  };
}

function styleGroups(
  view: ComponentViewRecord | undefined,
  paired: ReadonlySet<string>,
  root: string | undefined,
): Set<string> {
  return new Set(
    view?.styles
      .filter((style) =>
        style.componentIds.every((id) => id !== root && paired.has(id)),
      )
      .map((style) => canonicalJson(style.componentIds)),
  );
}

/** Real consumer invocations can expose implementation branches absent from saved variants. */
export function changedComponentImplementations(
  before: string,
  after: string,
  base: ComponentViewRecord | undefined,
  head: ComponentViewRecord | undefined,
  baseRanges?: readonly RenderedRange[],
  headRanges?: readonly RenderedRange[],
): ReadonlySet<string> {
  const changed = new Set<string>();
  if (!base || !head) return changed;
  const current = new Map(
    head.instances.map((instance) => [instance.key, instance]),
  );
  const pairs = new Map(
    base.instances
      .filter(
        (instance) =>
          current.get(instance.key)?.componentId === instance.componentId,
      )
      .map((instance) => [instance.key, instance.componentId]),
  );
  const validatedBase =
    baseRanges ?? validateComponentRanges(before, base.ranges, "historical");
  const validatedHead =
    headRanges ?? validateComponentRanges(after, head.ranges);
  for (const instance of base.instances) {
    const other = current.get(instance.key);
    if (
      !other ||
      other.componentId !== instance.componentId ||
      other.propsKey !== instance.propsKey
    )
      continue;
    const owner: ComponentInputOwner = {
      kind: "instance",
      instanceKey: instance.key,
    };
    const contents = (
      html: string,
      view: ComponentViewRecord,
      ranges: readonly RenderedRange[],
      historical = false,
    ): string[] => [
      ...new Set(
        ranges
          .filter(
            (range) =>
              range.record.target.kind === "instance" &&
              range.record.target.instanceKey === instance.key,
          )
          .map((range) => {
            const projected = projectOwnedMaterial(
              html,
              view,
              pairs,
              new Set(),
              ranges,
              owner,
              {
                start: range.contentStart,
                end: range.contentEnd,
              },
            );
            const material = historical
              ? stripHistoricalMarkers(projected)
              : projected;
            normalizeSingleDocument(material, instance.componentId);
            return material;
          }),
      ),
    ];
    const inputs = (view: ComponentViewRecord) =>
      view.instances
        .filter((child) => sameOwner(child.owner, owner))
        .map((child) => ({ key: child.key, propsKey: child.propsKey }));
    const left = contents(before, base, validatedBase, true);
    const right = contents(after, head, validatedHead);
    const match = (a: string, b: string) => {
      const pair = normalizeReviewPair(a, b, instance.componentId);
      return pair.base === pair.head;
    };
    if (
      !left.every((a) => right.some((b) => match(a, b))) ||
      !right.every((b) => left.some((a) => match(a, b))) ||
      canonicalJson(inputs(base)) !== canonicalJson(inputs(head)) ||
      canonicalJson(structureSignals(base, owner)) !==
        canonicalJson(structureSignals(head, owner))
    )
      changed.add(instance.componentId);
  }
  return changed;
}
