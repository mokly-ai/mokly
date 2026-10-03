import {
  cssAnalysis,
  mergeCssAnalysis,
  canonicalJson,
  reviewInvalid,
} from "@mokly/viewer/data";
import type {
  CssRuleAttribution,
  DependencyAnalysis,
  DependencyReason,
} from "@mokly/viewer/data";

import type { CssMatchingPair, CssOutputRange } from "./containment.js";
import type { CssElementMatch } from "./match_types.js";

export interface CssOutputMatch {
  match: CssElementMatch;
  occurrences: readonly CssOutputRange[];
  selector: string;
  root?: string;
  nested: readonly string[];
  components: readonly string[];
}

export interface CollectedCssRule {
  ruleKey?: string;
  status: "matched" | "unresolved";
  selectors: readonly string[];
  matches: readonly CssOutputMatch[];
}

/** Frozen own-page facts drive component and page projection for every delivery. */
export class CssAttribution {
  private readonly records = new WeakMap<
    DependencyAnalysis,
    readonly CollectedCssRule[]
  >();
  private readonly unfiltered = new Map<string, Set<string>>();
  private readonly changed = new Map<string, Set<string>>();
  private readonly all: CollectedCssRule[] = [];
  private frozen = false;

  record(rules: readonly CollectedCssRule[]): DependencyAnalysis {
    if (
      this.frozen &&
      rules.some((rule) => rule.matches.some((match) => match.root))
    )
      reviewInvalid(
        "CSS own-page proof must be collected before classification",
      );
    this.all.push(...rules);
    for (const rule of rules) {
      if (!rule.ruleKey) continue;
      const roots = this.unfiltered.get(rule.ruleKey) ?? new Set<string>();
      for (const match of rule.matches) if (match.root) roots.add(match.root);
      this.unfiltered.set(rule.ruleKey, roots);
    }
    const analysis = this.summarize(rules);
    this.records.set(analysis, rules);
    return analysis;
  }

  freeze(): void {
    this.changed.clear();
    for (const rule of this.all) {
      if (!rule.ruleKey) continue;
      const changed = this.changed.get(rule.ruleKey) ?? new Set<string>();
      for (const match of rule.matches)
        if (match.root && this.keeps(rule.ruleKey, match, match.root))
          changed.add(match.root);
      this.changed.set(rule.ruleKey, changed);
    }
    this.frozen = true;
  }

  /** Check public ids against retained unfiltered and kept own-page proof. */
  validate(analysis: DependencyAnalysis): void {
    if (!this.frozen) reviewInvalid("CSS catalogue proof is not frozen");
    for (const rule of analysis.rules) {
      const proved = rule.ruleKey
        ? (this.changed.get(rule.ruleKey) ?? new Set<string>())
        : new Set<string>();
      if (
        canonicalJson(rule.changedComponentIds) !==
        canonicalJson([...proved].sort())
      )
        reviewInvalid("CSS component proof differs from kept own-page matches");
    }
  }

  /** Project eligible rules, never just a retained stylesheet path. */
  project(
    reason: DependencyReason,
    mode: "view" | "page" | "component",
    root?: string,
  ): DependencyReason | undefined {
    if (!reason.analysis) return mode === "component" ? undefined : reason;
    const records = this.records.get(reason.analysis);
    if (!records) return mode === "component" ? undefined : reason;
    const selected =
      mode === "component"
        ? records.filter(
            (rule) =>
              root &&
              rule.ruleKey &&
              rule.matches.some((match) =>
                this.keeps(rule.ruleKey!, match, root),
              ),
          )
        : records;
    const analysis = this.summarize(selected);
    const rules =
      mode === "page"
        ? analysis.rules.filter(
            (rule) => rule.status === "unresolved" || rule.pageSelectors.length,
          )
        : analysis.rules;
    return rules.length
      ? { ...reason, analysis: cssAnalysis(rules) }
      : undefined;
  }

  private keeps(key: string, match: CssOutputMatch, root: string): boolean {
    return (
      match.root === root &&
      !match.nested.some(
        (id) => id !== root && this.unfiltered.get(key)?.has(id),
      )
    );
  }

  private summarize(records: readonly CollectedCssRule[]): DependencyAnalysis {
    const rules: CssRuleAttribution[] = records.map((record) => {
      const changed = record.ruleKey
        ? (this.changed.get(record.ruleKey) ?? new Set<string>())
        : new Set<string>();
      return {
        ...(record.ruleKey ? { ruleKey: record.ruleKey } : {}),
        status: record.status,
        selectors: record.selectors,
        changedComponentIds: [...changed].sort(),
        pageSelectors: [
          ...new Set(
            record.matches
              .filter(
                (match) => !match.components.some((id) => changed.has(id)),
              )
              .map((match) => match.selector),
          ),
        ].sort(),
      };
    });
    return mergeCssAnalysis(rules.map((rule) => cssAnalysis([rule])));
  }
}

export function outputMatch(
  match: CssElementMatch,
  pair: CssMatchingPair,
): CssOutputMatch {
  const offset = match.element.sourceCodeLocation?.startTag?.startOffset;
  const ranges =
    offset === undefined
      ? []
      : (pair.ranges?.get(match.document) ?? []).filter(
          (range) => range.start <= offset && offset < range.end,
        );
  const root = ranges.find((range) => range.root)?.componentId;
  return {
    match,
    occurrences: ranges,
    selector: match.selector,
    ...(root ? { root } : {}),
    nested: ranges
      .filter((range) => !range.root)
      .map((range) => range.componentId),
    components: ranges.map((range) => range.componentId),
  };
}
