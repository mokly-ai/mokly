/** Detect changes to custom properties and URL references in rule material. */
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
    JSON.stringify(references(before)) !== JSON.stringify(references(after))
  );
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

function references(rule?: CssRule): readonly string[] {
  if (!rule) return [];
  return [
    ...rule.conditions
      .filter((condition) => condition.kind !== "nesting-parent")
      .map((condition) => condition.prelude),
    rule.declarations,
  ].flatMap(urls);
}

function urls(text: string): readonly string[] {
  const source = new CssSource(text);
  const references: string[] = [];
  for (let index = 0; index < source.tokens.length; index += 1) {
    const token = source.tokens[index]!;
    if (
      token.word &&
      decodeCssIdentifier(token.value).toLowerCase() === "url" &&
      source.tokens[index + 1]?.value === "(" &&
      source.tokens[index + 1]?.start === token.end
    ) {
      const end = source.closing(index + 1);
      const value = source.tokens[index + 2]?.value ?? "";
      references.push(decodeCssIdentifier(value.slice(1, -1)));
      index = end;
    } else if (!token.word && token.value.endsWith(")")) {
      const opening = token.value.indexOf("(");
      if (
        opening >= 0 &&
        decodeCssIdentifier(token.value.slice(0, opening)).toLowerCase() ===
          "url"
      )
        references.push(
          decodeCssIdentifier(token.value.slice(opening + 1, -1)),
        );
    }
  }
  return references;
}
