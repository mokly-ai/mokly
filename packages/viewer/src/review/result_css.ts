import { cssAnalysis } from "./css/evidence.js";
import {
  requireEqual,
  requireOrdered,
  reviewArray,
  reviewId,
  reviewInvalid,
  reviewObject,
  reviewStrings,
} from "./result_helpers.js";
import type { CssRuleAttribution } from "./types.js";

/** Decode rule evidence without private DOM coordinates or source paths. */
export function validateCssAnalysis(value: unknown, aggregate = true): void {
  const analysis = reviewObject(
    value,
    ["status", "selectors", "rules"],
    ["pageEvidence"],
  );
  const rules = reviewArray(analysis.rules);
  if (!rules.length) reviewInvalid("stylesheet analysis requires rules");
  const keys: string[] = [];
  for (const value of rules) {
    const rule = reviewObject(
      value,
      ["status", "selectors", "changedComponentIds", "pageSelectors"],
      ["ruleKey"],
    );
    if (rule.status !== "matched" && rule.status !== "unresolved")
      reviewInvalid("invalid stylesheet rule status");
    if (
      rule.ruleKey !== undefined &&
      (typeof rule.ruleKey !== "string" || !/^[a-f0-9]{64}$/.test(rule.ruleKey))
    )
      reviewInvalid("invalid stylesheet rule key");
    const selectors = reviewStrings(rule.selectors);
    const ids = reviewStrings(rule.changedComponentIds, reviewId);
    const page = reviewStrings(rule.pageSelectors);
    if (page.some((selector) => !selectors.includes(selector)))
      reviewInvalid("page selectors must belong to their rule");
    if (
      rule.status === "matched" &&
      (!selectors.length || rule.ruleKey === undefined)
    )
      reviewInvalid("matched rule needs selectors and identity");
    if (
      rule.ruleKey === undefined &&
      (ids.length || page.length || (!aggregate && rules.length !== 1))
    )
      reviewInvalid("unkeyed failure cannot prove component or page matches");
    keys.push(typeof rule.ruleKey === "string" ? rule.ruleKey : "~");
  }
  requireOrdered(keys, (key) => key);
  reviewStrings(analysis.selectors);
  if (analysis.pageEvidence !== undefined) {
    const page = reviewObject(
      analysis.pageEvidence,
      ["selectors"],
      ["unresolved"],
    );
    reviewStrings(page.selectors);
    if (Object.hasOwn(page, "unresolved") && page.unresolved !== true)
      reviewInvalid("unresolved page evidence must be true");
  }
  requireEqual(analysis, cssAnalysis(rules as unknown as CssRuleAttribution[]));
}
