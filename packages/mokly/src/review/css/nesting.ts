/** Resolve nested selectors without weakening uncertain parent constraints. */
import { CssSelectorError } from "./match_types.js";
import { CssSource } from "./source.js";
import type { CssRule } from "./types.js";

/** Flatten nesting through :is(), retaining every parent-list alternative. */
export function resolveRuleSelectors(rule: CssRule): readonly string[] {
  let parent: string | undefined;
  for (const condition of rule.conditions)
    if (condition.kind === "nesting-parent")
      parent = combine(condition.prelude, parent);
  return rule.selectors.map((selector) => combine(selector, parent));
}

function combine(selector: string, parent: string | undefined): string {
  const source = new CssSource(selector);
  const parts: string[] = [];
  let start = 0;
  for (let index = 0; index < source.tokens.length; index += 1) {
    const token = source.tokens[index]!;
    if (token.value === "(" || token.value === "[")
      index = source.closing(index);
    else if (token.value === ",") {
      parts.push(substitute(selector.slice(start, token.start), parent));
      start = token.end;
    }
  }
  parts.push(substitute(selector.slice(start), parent));
  return parts.join(", ");
}

function substitute(selector: string, parent: string | undefined): string {
  const source = new CssSource(selector);
  let result = "";
  let start = 0;
  let substituted = false;
  for (let index = 0; index < source.tokens.length; index += 1) {
    const token = source.tokens[index]!;
    if (token.value === "[") index = source.closing(index);
    else if (token.value === "&") {
      const next = source.tokens[index + 1];
      if (!parent || (next?.word && next.start === token.end))
        throw new CssSelectorError("unresolved-nesting");
      result += `${selector.slice(start, token.start)}:is(${parent})`;
      start = token.end;
      substituted = true;
    }
  }
  result += selector.slice(start);
  return parent && !substituted
    ? `:is(${parent}) ${result.trim()}`
    : result.trim();
}
