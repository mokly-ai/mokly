import { classifyResourceUrl } from "../../resource_url.js";
import {
  decodeCssIdentifier,
  tokenizeCss,
  type CssSourceToken,
} from "../../review/css/source.js";

interface Replacement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

/** Restore local url() images normalized to strings by Lightning CSS Modules. */
export function restoreModuleImageSetUrls(css: string): string {
  const tokens = tokenizeCss(css);
  const replacements: Replacement[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const opening = tokens[index + 1];
    if (
      !token.word ||
      decodeCssIdentifier(token.value).toLowerCase() !== "image-set" ||
      opening?.value !== "(" ||
      opening.start !== token.end
    )
      continue;
    collectOptions(tokens, index + 2, replacements);
  }
  let restored = css;
  for (const replacement of replacements.sort(
    (left, right) => right.start - left.start,
  ))
    restored =
      restored.slice(0, replacement.start) +
      replacement.text +
      restored.slice(replacement.end);
  return restored;
}

function collectOptions(
  tokens: readonly CssSourceToken[],
  start: number,
  replacements: Replacement[],
): void {
  let depth = 1;
  let optionStart = start;
  for (let cursor = start; cursor < tokens.length; cursor += 1) {
    const value = tokens[cursor]!.value;
    if (value === "(") depth += 1;
    else if (value === ")") depth -= 1;
    if (depth === 0 || (depth === 1 && value === ",")) {
      const first = tokens[optionStart];
      if (first && optionStart < cursor && isLocalString(first))
        replacements.push({
          start: first.start,
          end: first.end,
          text: `url(${first.value})`,
        });
      if (depth === 0) return;
      optionStart = cursor + 1;
    }
  }
}

function isLocalString(token: CssSourceToken): boolean {
  const quote = token.value[0];
  return (
    (quote === '"' || quote === "'") &&
    classifyResourceUrl(decodeCssIdentifier(token.value.slice(1, -1)), "css")
      .kind !== "external"
  );
}
