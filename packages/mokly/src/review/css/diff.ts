/** Diff ordered CSS rules as multisets while preserving both changed sides. */
import { CssRuleParseError } from "./types.js";
import type {
  CssRule,
  CssRuleChange,
  CssRuleDiffResult,
  CssRuleParser,
  CssRuleParseResult,
} from "./types.js";

/** Compare rule multisets, cancelling exact identities before pairing edits. */
export function diffCssRules(
  before: string,
  after: string,
  parser: CssRuleParser,
): CssRuleDiffResult {
  const base = parse(parser, before);
  const head = parse(parser, after);
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
  const baseGroups = groupRules(base.rules);
  const headGroups = groupRules(head.rules);
  const added: CssRule[] = [];
  const removed: CssRule[] = [];
  const changed: CssRuleChange[] = [];
  for (const key of new Set([...baseGroups.keys(), ...headGroups.keys()])) {
    const bases = baseGroups.get(key) ?? [];
    const heads = headGroups.get(key) ?? [];
    const exact = new Map<string, CssRule[]>();
    for (const rule of [...bases].reverse()) {
      const bucket = exact.get(rule.declarations) ?? [];
      bucket.push(rule);
      exact.set(rule.declarations, bucket);
    }
    const matched = new Set<CssRule>();
    const remainingHeads = heads.filter((rule) => {
      const match = exact.get(rule.declarations)?.pop();
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
}

function parse(parser: CssRuleParser, stylesheet: string): CssRuleParseResult {
  try {
    return parser.parse(stylesheet);
  } catch (cause) {
    return { status: "unresolved", error: new CssRuleParseError(cause) };
  }
}

function groupRules(rules: readonly CssRule[]): Map<string, CssRule[]> {
  const groups = new Map<string, CssRule[]>();
  for (const rule of [...rules].sort(byOrdinal)) {
    const key = JSON.stringify([
      rule.conditions.map(({ kind, prelude }) => [kind, prelude]),
      rule.selectors,
      rule.atRule ?? null,
      rule.prelude ?? null,
    ]);
    const bucket = groups.get(key) ?? [];
    bucket.push(rule);
    groups.set(key, bucket);
  }
  return groups;
}

function byOrdinal(a: CssRule, b: CssRule): number {
  return a.ordinal - b.ordinal;
}
