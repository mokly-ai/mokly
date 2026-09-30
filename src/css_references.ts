import { documentWorkSync } from "./diagnostics/timings.js";
/** Shared token-aware extraction for CSS resource references. */
import { decodeCssIdentifier, tokenizeCss } from "./review/css/source.js";

/** Cheap sound prefilter used before tokenizing CSS or discovering inline spans. */
export function mayContainCssReferences(content: string): boolean {
  return /url\(|@import|\\/i.test(content);
}

/** Extract `url()` and string-form `@import` references from CSS. */
export function extractCssReferences(content: string): string[] {
  return documentWorkSync("referenceMs", () => {
    if (!mayContainCssReferences(content)) return [];
    const tokens = tokenizeCss(content, { allowIncomplete: true });
    const references: string[] = [];
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
          references.push(
            decodeCssIdentifier(token.value.slice(opening + 1, -1)),
          );
      } else if (
        token.word &&
        decodeCssIdentifier(token.value).toLowerCase() === "url" &&
        next?.value === "(" &&
        next.start === token.end
      ) {
        const value = tokens[index + 2]?.value;
        if (value && /^["']/.test(value) && tokens[index + 3]?.value === ")") {
          references.push(decodeCssIdentifier(value.slice(1, -1)));
          index += 3;
        }
      } else if (
        token.value === "@" &&
        next?.start === token.end &&
        decodeCssIdentifier(next.value).toLowerCase() === "import"
      ) {
        const value = tokens[index + 2]?.value;
        if (value && /^["']/.test(value)) {
          references.push(decodeCssIdentifier(value.slice(1, -1)));
          index += 2;
        }
      }
    }
    return references;
  });
}
