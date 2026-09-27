/** Orchestrate pure inline-style span discovery, diffing, matching, and ownership. */
import type { ComponentViewRecord } from "@mokly/viewer";

import type { RenderedRange } from "../../components/ranges.js";
import { timeSync } from "../../diagnostics/timings.js";

import { diffCssRuleLists } from "./diff.js";
import type { CssDocument } from "./document.js";
import { createElementOwnerIndex } from "./element_owners.js";
import { parseInlineRuleList } from "./inline_rule_lists.js";
import {
  attributeInlineRule,
  type AttributedInlineRule,
} from "./inline_rule_matching.js";
import {
  findUnownedInlineStyles,
  type InlineStyleSpan,
} from "./inline_styles.js";
import type { CssRule, CssRuleDiffResult, CssRuleParser } from "./types.js";

/** One source side plus its separately validated normalized matching tree. */
export interface InlineAttributionSide {
  source: string;
  sourceRanges: readonly RenderedRange[];
  document: CssDocument;
  ranges: readonly RenderedRange[];
  usage: ComponentViewRecord;
}

/** Pure analysis inputs for one paired component-aware view. */
export interface InlineAttributionInput {
  before: InlineAttributionSide;
  after: InlineAttributionSide;
  pairedIgnoreIds: readonly string[];
  rootComponentId?: string | undefined;
  parser: CssRuleParser;
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
  if (sameOuterSources(beforeSpans, afterSpans))
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

  const beforeOwners = createElementOwnerIndex({
    ranges: input.before.ranges,
    usage: input.before.usage,
    counterpart: input.after.usage,
    rootComponentId: input.rootComponentId,
  });
  const afterOwners = createElementOwnerIndex({
    ranges: input.after.ranges,
    usage: input.after.usage,
    counterpart: input.before.usage,
    rootComponentId: input.rootComponentId,
  });
  const diff = diffCssRuleLists(before.rules, after.rules);
  const rules = deltas(diff).map((change) =>
    attributeInlineRule(
      change,
      { document: input.before.document, owners: beforeOwners },
      { document: input.after.document, owners: afterOwners },
    ),
  );
  const retained = rules.filter(({ attribution }) =>
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
    rules
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
}

function deltas(diff: Extract<CssRuleDiffResult, { status: "resolved" }>) {
  return [
    ...diff.added.map((after) => ({ kind: "added" as const, after })),
    ...diff.removed.map((before) => ({ kind: "removed" as const, before })),
    ...diff.changed.map((change) => ({ kind: "changed" as const, ...change })),
  ];
}

function sameOuterSources(
  before: readonly InlineStyleSpan[],
  after: readonly InlineStyleSpan[],
): boolean {
  return (
    before.length === after.length &&
    before.every((span, index) => span.source === after[index]?.source)
  );
}
