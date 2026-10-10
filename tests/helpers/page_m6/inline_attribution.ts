/** Orchestrate pure inline-style span discovery, diffing, matching, and ownership. */
import type { ComponentViewRecord } from "@mokly/viewer";

import type { RenderedRange } from "../../../dist/components/ranges.js";
import { mayContainCssReferences } from "../../../dist/css_references.js";
import {
  documentWorkSync,
  timeSync,
} from "../../../dist/diagnostics/timings.js";
import type { diffCssRuleLists } from "../../../dist/review/css/diff.js";
import type { CssDocument } from "../../../dist/review/css/document.js";
import { createElementOwnerIndex } from "../../../dist/review/css/element_owners.js";
import {
  attributeInlineRule,
  type AttributedInlineRule,
} from "../../../dist/review/css/inline_rule_matching.js";
import {
  parseInlineRuns,
  type InlineRunOccurrence,
} from "../../../dist/review/css/inline_rule_runs.js";
import { inlineSegmentChanges } from "../../../dist/review/css/inline_segment_changes.js";
import type {
  CssRuleDiffResult,
  CssRuleParser,
} from "../../../dist/review/css/types.js";

import {
  findUnownedInlineStyles,
  sameInlineOuterSources,
  type InlineStyleSpan,
} from "./inline_styles.js";

/** One source side plus its separately validated normalized matching tree. */
export interface InlineAttributionSide {
  source: string;
  sourceRanges: readonly RenderedRange[];
  usage: ComponentViewRecord;
}

/** Lazily prepared normalized document and ranges for selector ownership. */
export interface InlineAttributionMatchingSide {
  document: CssDocument;
  ranges: readonly RenderedRange[];
}

/** Pure analysis inputs for one paired component-aware view. */
export interface InlineAttributionInput {
  before: InlineAttributionSide;
  after: InlineAttributionSide;
  pairedIgnoreIds: readonly string[];
  rootComponentId?: string | undefined;
  parser: CssRuleParser;
  diffRules?: typeof diffCssRuleLists;
  prepare: () => {
    before: InlineAttributionMatchingSide;
    after: InlineAttributionMatchingSide;
  };
}

interface CommonResult {
  beforeSpans: readonly InlineStyleSpan[];
  afterSpans: readonly InlineStyleSpan[];
}

/** Result used by comparison-material rendering and later evidence projection. */
export type InlineAttributionResult = CommonResult &
  (
    | { status: "skipped" }
    | {
        status: "unresolved";
        failures: Extract<
          CssRuleDiffResult,
          { status: "unresolved" }
        >["failures"];
        retainedSelectors: {
          status: "unresolved";
          selectors: readonly [];
        };
      }
    | {
        status: "resolved";
        beforeRuns: readonly InlineRunOccurrence[];
        afterRuns: readonly InlineRunOccurrence[];
        rules: readonly AttributedInlineRule[];
        retainedSelectors?: {
          status: "matched" | "unresolved";
          selectors: readonly string[];
        };
        ownedComponentIds: ReadonlySet<string>;
      }
  );

/** Analyze one view under a single privacy-safe diagnostic span. */
export function attributeInlineRules(
  input: InlineAttributionInput,
): InlineAttributionResult {
  return timeSync("review.inline-style-analysis", () => analyze(input));
}

function analyze(input: InlineAttributionInput): InlineAttributionResult {
  return documentWorkSync("inlineRuleMs", () => {
    const paired = new Set(input.pairedIgnoreIds);
    const beforeSpans = findUnownedInlineStyles(
      input.before.source,
      input.before.sourceRanges,
      paired,
    );
    const afterSpans = findUnownedInlineStyles(
      input.after.source,
      input.after.sourceRanges,
      paired,
    );
    const common = { beforeSpans, afterSpans };
    const outerSourcesEqual = sameInlineOuterSources(beforeSpans, afterSpans);
    if (
      outerSourcesEqual &&
      ![...beforeSpans, ...afterSpans].some((span) =>
        mayContainCssReferences(span.text),
      )
    )
      return { ...common, status: "skipped" };

    const before = parseInlineRuns(beforeSpans, input.parser);
    const after = parseInlineRuns(afterSpans, input.parser);
    if (before.status === "unresolved" || after.status === "unresolved")
      return {
        ...common,
        status: "unresolved",
        failures: [
          ...(before.status === "unresolved"
            ? [{ side: "before" as const, error: before.error }]
            : []),
          ...(after.status === "unresolved"
            ? [{ side: "after" as const, error: after.error }]
            : []),
        ],
        retainedSelectors: { status: "unresolved", selectors: [] },
      };

    const analyzed = inlineSegmentChanges(
      before,
      after,
      input.diffRules,
    ).deltas;
    const material = {
      beforeRuns: before.occurrences,
      afterRuns: after.occurrences,
    };
    if (!analyzed.length)
      if (outerSourcesEqual) return { ...common, status: "skipped" };
      else
        return {
          ...common,
          status: "resolved",
          ...material,
          rules: [],
          ownedComponentIds: new Set(),
        };
    const matching = input.prepare();
    const beforeOwners = createElementOwnerIndex({
      ranges: matching.before.ranges,
      usage: input.before.usage,
      counterpart: input.after.usage,
      rootComponentId: input.rootComponentId,
    });
    const afterOwners = createElementOwnerIndex({
      ranges: matching.after.ranges,
      usage: input.after.usage,
      counterpart: input.before.usage,
      rootComponentId: input.rootComponentId,
    });
    const rules = analyzed.map((change) =>
      attributeInlineRule(
        change,
        { document: matching.before.document, owners: beforeOwners },
        { document: matching.after.document, owners: afterOwners },
      ),
    );
    const diffedRules = rules.filter(
      ({ change }) => change.kind !== "unchanged",
    );
    const retained = diffedRules.filter(({ attribution }) =>
      ["entry", "unresolved"].includes(attribution.kind),
    );
    const retainedSelectors = retained.length
      ? {
          status: retained.some(
            ({ attribution }) => attribution.kind === "unresolved",
          )
            ? ("unresolved" as const)
            : ("matched" as const),
          selectors: [
            ...new Set(retained.flatMap(({ selectors }) => selectors)),
          ].sort(),
        }
      : undefined;
    const ownedComponentIds = new Set(
      diffedRules
        .flatMap(({ attribution }) =>
          attribution.kind === "owned" ? attribution.componentIds : [],
        )
        .sort(),
    );
    return {
      ...common,
      status: "resolved",
      ...material,
      rules,
      ...(retainedSelectors ? { retainedSelectors } : {}),
      ownedComponentIds,
    };
  });
}
