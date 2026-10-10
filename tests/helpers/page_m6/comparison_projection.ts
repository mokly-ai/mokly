import type { ComponentInputOwner, ComponentViewRecord } from "@mokly/viewer";
import { canonicalJson } from "@mokly/viewer/data";

import {
  validateComponentRanges,
  type RenderedRange,
} from "../../../dist/components/ranges.js";
import { documentWorkSync } from "../../../dist/diagnostics/timings.js";
import {
  applyInlineMaterial,
  type InlineMaterialReplacements,
} from "../../../dist/review/css/inline_rendering.js";
import {
  normalizeReviewPair,
  normalizeSingleDocument,
} from "../../../dist/review/ignore.js";

import {
  componentUsageSignals,
  projectOwnedMaterial,
  sameOwner,
  stripMarkers,
  structureSignals,
} from "./comparison_material.js";

export interface ComponentProjection {
  actual: { base: string; head: string; ignoredIds: readonly string[] };
  before: string;
  after: string;
  inputs: boolean;
  structure: boolean;
  rawEqual: boolean;
  ignoredIds: readonly string[];
  pairedComponentIds: ReadonlySet<string>;
}

export interface ComponentInlineMaterial {
  before: InlineMaterialReplacements;
  after: InlineMaterialReplacements;
}

const EMPTY_PROJECTION = { replacements: [], appendix: "" } as const;
const EMPTY_INLINE: InlineMaterialReplacements = {
  actual: EMPTY_PROJECTION,
  projected: EMPTY_PROJECTION,
};

/** Project only mutually proven implementations; data and rendered slots stay with their caller. */
export function projectComponentPair(
  before: string,
  after: string,
  beforeView: ComponentViewRecord | undefined,
  afterView: ComponentViewRecord | undefined,
  context: string,
  rootComponentId?: string,
  inline: ComponentInlineMaterial = {
    before: EMPTY_INLINE,
    after: EMPTY_INLINE,
  },
  beforeRanges?: readonly RenderedRange[],
  afterRanges?: readonly RenderedRange[],
): ComponentProjection {
  return documentWorkSync("projectionMs", () => {
    const validatedBefore = beforeView
      ? (beforeRanges ?? validateComponentRanges(before, beforeView.ranges))
      : undefined;
    const validatedAfter = afterView
      ? (afterRanges ?? validateComponentRanges(after, afterView.ranges))
      : undefined;
    const actualBefore = stripMarkers(
      applyInlineMaterial(before, inline.before.actual),
      beforeView,
      validatedBefore,
    );
    const actualAfter = stripMarkers(
      applyInlineMaterial(after, inline.after.actual),
      afterView,
      validatedAfter,
    );
    const rawBefore = normalizeSingleDocument(actualBefore, context);
    const rawAfter = normalizeSingleDocument(actualAfter, context);
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
    const left =
      beforeView && afterView
        ? projectOwnedMaterial(
            before,
            beforeView,
            pairs,
            inline.before.projected,
            validatedBefore,
          )
        : stripMarkers(before, beforeView, validatedBefore);
    const right =
      beforeView && afterView
        ? projectOwnedMaterial(
            after,
            afterView,
            pairs,
            inline.after.projected,
            validatedAfter,
          )
        : stripMarkers(after, afterView, validatedAfter);
    const normalized = normalizeReviewPair(left, right, context);
    const actual = normalizeReviewPair(actualBefore, actualAfter, context);
    const { inputs, structure } = componentUsageSignals(beforeView, afterView);
    return {
      actual,
      before: normalized.base,
      after: normalized.head,
      inputs,
      structure,
      rawEqual: rawBefore === rawAfter,
      ignoredIds: normalized.ignoredIds,
      pairedComponentIds,
    };
  });
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
  return documentWorkSync("implementationMs", () => {
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
      baseRanges ?? validateComponentRanges(before, base.ranges);
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
                EMPTY_PROJECTION,
                ranges,
                owner,
                {
                  start: range.contentStart,
                  end: range.contentEnd,
                },
              );
              normalizeSingleDocument(projected, instance.componentId);
              return projected;
            }),
        ),
      ];
      const inputs = (view: ComponentViewRecord) =>
        view.instances
          .filter((child) => sameOwner(child.owner, owner))
          .map((child) => ({ key: child.key, propsKey: child.propsKey }));
      const left = contents(before, base, validatedBase);
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
  });
}
