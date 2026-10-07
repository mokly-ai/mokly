import { Rule, type AtRule, type Root } from "postcss";

import { MoklyError } from "../../errors.js";

import {
  CSS_COMMENT,
  CSS_NORMAL,
  CSS_WHITESPACE,
  isCssWhitespaceCharacter,
  scanCssText,
  type CssScan,
} from "./module_css_scan.js";

/** A selector interior without the surrounding parentheses. */
export interface ScopeGroup {
  readonly start: number;
  readonly end: number;
}

/** Optional start and limit selectors in an `@scope` prelude. */
export interface ScopePrelude {
  readonly start?: ScopeGroup;
  readonly limit?: ScopeGroup;
}

/** Parse optional selector groups without splitting identifiers containing `to`. */
export function scanScopePrelude(params: string): ScopePrelude {
  const scan = scanCssText(params);
  let cursor = skipTrivia(scan, 0);
  if (cursor === params.length) return {};
  let start: ScopeGroup | undefined;
  if (params[cursor] === "(") {
    const parsed = readGroup(scan, cursor);
    start = parsed.group;
    cursor = skipTrivia(scan, parsed.end);
  }
  let limit: ScopeGroup | undefined;
  if (cursor < params.length) {
    if (params.slice(cursor, cursor + 2).toLowerCase() !== "to")
      throw new Error("invalid scope prelude");
    const following = params[cursor + 2];
    if (
      following &&
      !isCssWhitespaceCharacter(following) &&
      following !== "(" &&
      following !== ")" &&
      params.slice(cursor + 2, cursor + 4) !== "/*"
    )
      throw new Error("invalid scope prelude");
    cursor = skipTrivia(scan, cursor + 2);
    if (params[cursor] !== "(") throw new Error("invalid scope prelude");
    const parsed = readGroup(scan, cursor);
    limit = parsed.group;
    cursor = skipTrivia(scan, parsed.end);
  }
  if (cursor !== params.length || (!start && !limit))
    throw new Error("invalid scope prelude");
  return { ...(start ? { start } : {}), ...(limit ? { limit } : {}) };
}

interface HiddenScope {
  readonly atRule: AtRule;
  readonly name: string;
  readonly params: string;
  readonly groups: readonly {
    readonly group: ScopeGroup;
    readonly rule: Rule;
  }[];
}

/** Hide scope-suffixed at-rules while real scope groups become plugin-localized rules. */
export function prepareModuleScopes(root: Root, relative: string): () => void {
  const hidden: HiddenScope[] = [];
  root.walkAtRules((atRule) => {
    if (!/scope$/iu.test(atRule.name)) return;
    const name = atRule.name;
    const params = atRule.params;
    let groups: HiddenScope["groups"] = [];
    if (name.toLowerCase() === "scope") {
      let prelude: ScopePrelude;
      try {
        prelude = scanScopePrelude(params);
      } catch {
        const start = atRule.source?.start;
        throw new MoklyError(
          "build-invalid",
          `CSS Modules @scope prelude is invalid in ${relative}:${start?.line ?? 1}:${start?.column ?? 1}; use an optional (start) and/or to (limit)`,
        );
      }
      groups = [prelude.start, prelude.limit].flatMap((group) => {
        if (!group) return [];
        const rule = new Rule({
          selector: params.slice(group.start, group.end),
        });
        if (atRule.source) rule.source = atRule.source;
        atRule.before(rule);
        return [{ group, rule }];
      });
    }
    atRule.name = "mokly-inert-at-rule";
    hidden.push({ atRule, name, params, groups });
  });
  return () => {
    for (const entry of hidden) {
      let params = entry.params;
      for (const { group, rule } of [...entry.groups].sort(
        (a, b) => b.group.start - a.group.start,
      )) {
        if (!rule.parent || rule.parent !== entry.atRule.parent)
          throw new Error("temporary CSS scope selector was lost");
        params =
          params.slice(0, group.start) +
          rule.selector +
          params.slice(group.end);
        rule.remove();
      }
      entry.atRule.name = entry.name;
      entry.atRule.params = params;
    }
  };
}

function skipTrivia(scan: CssScan, from: number): number {
  let cursor = from;
  if (scan.unclosedComment) throw new Error("unterminated scope comment");
  while (
    scan.kinds[cursor] === CSS_WHITESPACE ||
    scan.kinds[cursor] === CSS_COMMENT
  )
    cursor += 1;
  return cursor;
}

function readGroup(
  scan: CssScan,
  open: number,
): { readonly group: ScopeGroup; readonly end: number } {
  const brackets: string[] = ["("];
  let cursor = open + 1;
  while (cursor < scan.text.length) {
    if (scan.kinds[cursor] !== CSS_NORMAL) {
      cursor += 1;
      continue;
    }
    const char = scan.text[cursor]!;
    if (char === "(" || char === "[") brackets.push(char);
    else if (char === ")" || char === "]") {
      if (brackets.pop() !== (char === ")" ? "(" : "["))
        throw new Error("mismatched scope group");
      if (!brackets.length) {
        const group = { start: open + 1, end: cursor };
        if (
          skipTrivia(
            scanCssText(scan.text.slice(group.start, group.end)),
            0,
          ) ===
          group.end - group.start
        )
          throw new Error("empty scope group");
        return { group, end: cursor + 1 };
      }
    }
    cursor += 1;
  }
  throw new Error("unterminated scope group");
}
