import { documentWorkSync } from "./diagnostics/timings.js";
import {
  decodeCssIdentifier,
  tokenizeCss,
  type CssSourceToken,
} from "./review/css/source.js";

/** Extract `url()` and string-form `@import` references from CSS. */
export function extractCssReferences(content: string): string[] {
  return documentWorkSync("referenceMs", () =>
    cssReferences(content).map(({ value }) => value),
  );
}

/** Rewrite only parsed CSS URL tokens, preserving every other source byte. */
export function rewriteCssReferences(
  content: string,
  rewrite: (value: string) => string,
): string {
  for (const reference of cssReferences(content).reverse()) {
    const value = rewrite(reference.value);
    if (value !== reference.value)
      content =
        content.slice(0, reference.start) +
        JSON.stringify(value) +
        content.slice(reference.end);
  }
  return content;
}

interface CssReference {
  start: number;
  end: number;
  value: string;
}

/** Sound prefilter shared by raw discovery and skipped inline preparation. */
export function mayContainCssReferences(content: string): boolean {
  return /url\(|image-set\(|@import|\\/i.test(content);
}

function cssReferences(content: string): CssReference[] {
  if (!mayContainCssReferences(content)) return [];
  const tokens = tokenizeCss(content, { allowIncomplete: true });
  const references: CssReference[] = [...imageSetStringReferences(tokens)];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (!token.word && token.value.endsWith(")")) {
      const opening = token.value.indexOf("(");
      if (
        opening >= 0 &&
        decodeCssIdentifier(token.value.slice(0, opening)).toLowerCase() ===
          "url"
      )
        references.push({
          start: token.start + opening + 1,
          end: token.end - 1,
          value: decodeCssIdentifier(token.value.slice(opening + 1, -1)),
        });
    } else if (
      token.word &&
      decodeCssIdentifier(token.value).toLowerCase() === "url" &&
      next?.value === "(" &&
      next.start === token.end
    ) {
      const value = tokens[index + 2]?.value;
      if (value && /^["']/.test(value) && tokens[index + 3]?.value === ")") {
        references.push({
          start: tokens[index + 2]!.start,
          end: tokens[index + 2]!.end,
          value: decodeCssIdentifier(value.slice(1, -1)),
        });
        index += 3;
      }
    } else if (
      token.value === "@" &&
      next?.start === token.end &&
      decodeCssIdentifier(next.value).toLowerCase() === "import"
    ) {
      const value = tokens[index + 2]?.value;
      if (value && /^["']/.test(value)) {
        references.push({
          start: tokens[index + 2]!.start,
          end: tokens[index + 2]!.end,
          value: decodeCssIdentifier(value.slice(1, -1)),
        });
        index += 2;
      }
    }
  }
  return references.sort((left, right) => left.start - right.start);
}

/** String-form image-set sources are not sent through esbuild's url-token resolver. */
export function extractImageSetStringReferences(content: string): string[] {
  if (!/image-set\(/i.test(content)) return [];
  return imageSetStringReferences(
    tokenizeCss(content, { allowIncomplete: true }),
  ).map(({ value }) => value);
}

function imageSetStringReferences(
  tokens: readonly CssSourceToken[],
): CssReference[] {
  const references: CssReference[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const next = tokens[index + 1];
    if (
      !token.word ||
      !["image-set", "-webkit-image-set"].includes(
        decodeCssIdentifier(token.value).toLowerCase(),
      ) ||
      next?.value !== "(" ||
      next.start !== token.end
    )
      continue;
    let depth = 1;
    for (let cursor = index + 2; cursor < tokens.length && depth; cursor += 1) {
      const current = tokens[cursor]!;
      if (current.value === "(") depth += 1;
      else if (current.value === ")") depth -= 1;
      else if (depth === 1 && /^['"]/.test(current.value))
        references.push({
          start: current.start,
          end: current.end,
          value: decodeCssIdentifier(current.value.slice(1, -1)),
        });
    }
  }
  return references;
}
