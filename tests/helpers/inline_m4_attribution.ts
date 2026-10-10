/** Orchestrate pure inline-style span discovery, diffing, matching, and ownership. */
import type { ComponentViewRecord } from "@mokly/viewer";

import type { RenderedRange } from "../../src/components/ranges.js";
import { mayContainCssReferences } from "../../src/css_references.js";
import { documentWorkSync, timeSync } from "../../src/diagnostics/timings.js";
import { diffCssRuleLists } from "../../src/review/css/diff.js";
import type { CssDocument } from "../../src/review/css/document.js";
import { createElementOwnerIndex } from "../../src/review/css/element_owners.js";
import {
  attributeInlineRule,
  type AttributedInlineRule,
} from "../../src/review/css/inline_rule_matching.js";
import {
  findUnownedInlineStyles,
  sameInlineOuterSources,
  type InlineStyleSpan,
} from "../../src/review/css/inline_styles.js";
import type {
  CssRule,
  CssRuleDiffResult,
  CssRuleParser,
} from "../../src/review/css/types.js";

import { inlineRuleDeltas } from "./inline_m4_deltas.js";
import { parseInlineRuleList } from "./inline_m4_lists.js";

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
        beforeRules: readonly CssRule[];
        afterRules: readonly CssRule[];
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

    const before = parseInlineRuleList(beforeSpans, input.parser);
    const after = parseInlineRuleList(afterSpans, input.parser);
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

    const diff = diffCssRuleLists(before.rules, after.rules);
    const analyzed = inlineRuleDeltas(diff, before.rules, after.rules);
    if (!analyzed.length)
      if (outerSourcesEqual) return { ...common, status: "skipped" };
      else
        return {
          ...common,
          status: "resolved",
          beforeRules: before.rules,
          afterRules: after.rules,
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
      beforeRules: before.rules,
      afterRules: after.rules,
      rules,
      ...(retainedSelectors ? { retainedSelectors } : {}),
      ownedComponentIds,
    };
  });
}
