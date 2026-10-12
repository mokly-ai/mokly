/** Detect changes to custom properties and resource references in rule material. */
import { cssRuleData } from "./rule_identity.js";
import { CssSource, decodeCssIdentifier } from "./source.js";
import type { CssRule } from "./types.js";

/** Compare custom declarations only, so unrelated edits do not trigger the keep rule. */
export function changedCustomProperties(
  before?: CssRule,
  after?: CssRule,
): boolean {
  return (
    JSON.stringify(customProperties(before)) !==
    JSON.stringify(customProperties(after))
  );
}

/** Keep added/removed/edited URL tokens, not an unchanged URL in a changed declaration block. */
export function changedReferences(before?: CssRule, after?: CssRule): boolean {
  return (
    JSON.stringify(cssRuleReferences(before)) !==
    JSON.stringify(cssRuleReferences(after))
  );
}

/** Find every resource reference that canonical rendering of one rule emits. */
export function cssRuleReferences(rule?: CssRule): readonly string[] {
  return rule ? cssRuleData(rule).references : [];
}

function customProperties(rule?: CssRule): readonly string[] {
  if (!rule?.hasCustomProperties) return [];
  const source = new CssSource(rule.declarations);
  const declarations: string[] = [];
  let start = 0;
  const retain = (end: number): void => {
    const token = source.tokens[start];
    if (
      token &&
      decodeCssIdentifier(token.value).startsWith("--") &&
      source.tokens[start + 1]?.value === ":"
    )
      declarations.push(rule.declarations.slice(token.start, end));
  };
  for (let index = 0; index < source.tokens.length; index += 1) {
    const token = source.tokens[index]!;
    if (["(", "[", "{"].includes(token.value)) index = source.closing(index);
    else if (token.value === ";") {
      retain(token.start);
      start = index + 1;
    }
  }
  retain(rule.declarations.length);
  return declarations;
}
