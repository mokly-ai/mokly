import { documentWorkSync } from "../../diagnostics/timings.js";

/** Diff ordered CSS rules as multisets while preserving both changed sides. */
import { cssRuleData } from "./rule_identity.js";
import { CssRuleParseError } from "./types.js";
import type {
  CssRule,
  CssRuleChange,
  CssRuleDiffResult,
  CssRuleParser,
  CssRuleParseResult,
} from "./types.js";

type ResolvedCssRuleDiff = Extract<CssRuleDiffResult, { status: "resolved" }>;

/** Compare rule multisets, cancelling exact identities before pairing edits. */
export function diffCssRules(
  before: string,
  after: string,
  parser: CssRuleParser,
): CssRuleDiffResult {
  return documentWorkSync("inlineRuleMs", () => {
    const base = parseCssRules(parser, before);
    const head = parseCssRules(parser, after);
    if (base.status === "unresolved" || head.status === "unresolved") {
      return {
        status: "unresolved",
        failures: [
          ...(base.status === "unresolved"
            ? [{ side: "before" as const, error: base.error }]
            : []),
          ...(head.status === "unresolved"
            ? [{ side: "after" as const, error: head.error }]
            : []),
        ],
      };
    }
    return diffCssRuleLists(base.rules, head.rules);
  });
}

/** Diff already-parsed rule lists without crossing stylesheet boundaries. */
export function diffCssRuleLists(
  before: readonly CssRule[],
  after: readonly CssRule[],
): ResolvedCssRuleDiff {
  return documentWorkSync("inlineRuleMs", () => {
    const baseGroups = groupRules(before);
    const headGroups = groupRules(after);
    const added: CssRule[] = [];
    const removed: CssRule[] = [];
    const changed: CssRuleChange[] = [];
    for (const key of new Set([...baseGroups.keys(), ...headGroups.keys()])) {
      const bases = baseGroups.get(key) ?? [];
      const heads = headGroups.get(key) ?? [];
      const exact = new Map<string, CssRule[]>();
      for (const rule of [...bases].reverse()) {
        const identity = cssRuleData(rule).identityKey;
        const bucket = exact.get(identity) ?? [];
        bucket.push(rule);
        exact.set(identity, bucket);
      }
      const matched = new Set<CssRule>();
      const remainingHeads = heads.filter((rule) => {
        const match = exact.get(cssRuleData(rule).identityKey)?.pop();
        if (!match) return true;
        matched.add(match);
        return false;
      });
      const remainingBases = bases.filter((rule) => !matched.has(rule));
      const count = Math.min(remainingBases.length, remainingHeads.length);
      for (let index = 0; index < count; index += 1) {
        changed.push({
          before: remainingBases[index]!,
          after: remainingHeads[index]!,
        });
      }
      removed.push(...remainingBases.slice(count));
      added.push(...remainingHeads.slice(count));
    }
    return {
      status: "resolved",
      added: added.sort(byOrdinal),
      removed: removed.sort(byOrdinal),
      changed: changed.sort((a, b) => byOrdinal(a.after, b.after)),
    };
  });
}

/** Contain parser exceptions behind the same unresolved result as parser errors. */
export function parseCssRules(
  parser: CssRuleParser,
  stylesheet: string,
): CssRuleParseResult {
  return documentWorkSync("inlineRuleMs", () => {
    try {
      return parser.parse(stylesheet);
    } catch (cause) {
      return { status: "unresolved", error: new CssRuleParseError(cause) };
    }
  });
}

function groupRules(rules: readonly CssRule[]): Map<string, CssRule[]> {
  const groups = new Map<string, CssRule[]>();
  for (const rule of [...rules].sort(byOrdinal)) {
    const key = cssRuleData(rule).addressKey;
    const bucket = groups.get(key) ?? [];
    bucket.push(rule);
    groups.set(key, bucket);
  }
  return groups;
}

function byOrdinal(a: CssRule, b: CssRule): number {
  return a.ordinal - b.ordinal;
}
