/** Orchestrate pure inline-style span discovery, diffing, matching, and ownership. */
import type { ComponentViewRecord } from "@mokly/viewer";

import type { RenderedRange } from "../../components/ranges.js";
import { documentWorkSync, timeSync } from "../../diagnostics/timings.js";

import type { diffCssRuleLists } from "./diff.js";
import type { CssDocument } from "./document.js";
import { createElementOwnerIndex } from "./element_owners.js";
import {
  prepareInlineRules,
  type PreparedInlineRules,
} from "./inline_preparation.js";
import {
  attributeInlineRule,
  type AttributedInlineRule,
} from "./inline_rule_matching.js";
import type { InlineRunOccurrence } from "./inline_rule_runs.js";
import {
  findUnownedInlineStyles,
  type InlineStyleSpan,
} from "./inline_styles.js";
import type { CssRuleDiffResult, CssRuleParser } from "./types.js";

/** One original source side with ranges and optional shared eligible spans. */
export interface InlineAttributionSide {
  source: string;
  sourceRanges: readonly RenderedRange[];
  usage: ComponentViewRecord;
  spans?: readonly InlineStyleSpan[];
}

/** Lazily prepared original or legacy-normalized tree and its ownership ranges. */
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
  prepared?: PreparedInlineRules;
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
  return timeSync("review.inline-style-analysis", () =>
    analyzeInlineRules(input),
  );
}

export function analyzeInlineRules(
  input: InlineAttributionInput,
): InlineAttributionResult {
  return documentWorkSync("inlineRuleMs", () => {
    const paired = new Set(input.pairedIgnoreIds);
    const beforeSpans =
      input.before.spans ??
      findUnownedInlineStyles(
        input.before.source,
        input.before.sourceRanges,
        paired,
      );
    const afterSpans =
      input.after.spans ??
      findUnownedInlineStyles(
        input.after.source,
        input.after.sourceRanges,
        paired,
      );
    const common = { beforeSpans, afterSpans };
    const prepared =
      input.prepared ??
      prepareInlineRules(
        beforeSpans,
        afterSpans,
        input.parser,
        input.diffRules,
      );
    if (prepared.status !== "resolved") return { ...common, ...prepared };
    const { beforeRuns, afterRuns, deltas: analyzed } = prepared;
    const material = { beforeRuns, afterRuns };
    if (!analyzed.length)
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
    const rules = analyzed.map(
      (change) =>
        prepared.attributedChanges?.get(change) ??
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
