/** Raw HTML scanning for Mokly-owned navigation metadata. */

/** A byte range within an HTML source string. */
export interface HtmlSourceLocation {
  readonly endOffset: number;
  readonly startOffset: number;
}

/** An occurrence of a reserved navigation attribute in a start tag. */
export interface ReservedAttributeOccurrence extends HtmlSourceLocation {
  readonly name: ReservedAttributeName;
}

/** Attribute names whose values are owned by Mokly. */
export type ReservedAttributeName = "data-mokly-link" | "data-mokly-target";

const RESERVED_ATTRIBUTES = new Set<ReservedAttributeName>([
  "data-mokly-link",
  "data-mokly-target",
]);

/** Find every reserved attribute, including duplicates hidden by HTML parsing. */
export function reservedAttributesInStartTag(
  content: string,
  startTag: HtmlSourceLocation | undefined,
): readonly ReservedAttributeOccurrence[] {
  if (!startTag) return [];
  const occurrences: ReservedAttributeOccurrence[] = [];
  let cursor = startTag.startOffset + 1;
  while (cursor < startTag.endOffset && !isNameTerminator(content[cursor])) {
    cursor += 1;
  }
  while (cursor < startTag.endOffset) {
    while (isHtmlWhitespace(content[cursor])) cursor += 1;
    if (content[cursor] === ">") break;
    if (content[cursor] === "/") {
      cursor += 1;
      continue;
    }
    const startOffset = cursor;
    while (cursor < startTag.endOffset && !isNameTerminator(content[cursor])) {
      cursor += 1;
    }
    if (cursor === startOffset) {
      cursor += 1;
      continue;
    }
    const name = content.slice(startOffset, cursor).toLowerCase();
    while (isHtmlWhitespace(content[cursor])) cursor += 1;
    if (content[cursor] === "=") {
      cursor += 1;
      while (isHtmlWhitespace(content[cursor])) cursor += 1;
      const quote = content[cursor];
      if (quote === '"' || quote === "'") {
        cursor += 1;
        while (cursor < startTag.endOffset && content[cursor] !== quote) {
          cursor += 1;
        }
        if (content[cursor] === quote) cursor += 1;
      } else {
        while (
          cursor < startTag.endOffset &&
          !isHtmlWhitespace(content[cursor]) &&
          content[cursor] !== ">"
        ) {
          cursor += 1;
        }
      }
    }
    if (isReservedAttributeName(name)) {
      occurrences.push({ endOffset: cursor, name, startOffset });
    }
  }
  return occurrences;
}

/** Return the first reserved name occurring more than once in one start tag. */
export function duplicateReservedAttributeName(
  content: string,
  startTag: HtmlSourceLocation | undefined,
): ReservedAttributeName | undefined {
  const seen = new Set<ReservedAttributeName>();
  for (const occurrence of reservedAttributesInStartTag(content, startTag)) {
    if (seen.has(occurrence.name)) return occurrence.name;
    seen.add(occurrence.name);
  }
  return undefined;
}

function isReservedAttributeName(
  value: string,
): value is ReservedAttributeName {
  return RESERVED_ATTRIBUTES.has(value as ReservedAttributeName);
}

function isHtmlWhitespace(value: string | undefined): boolean {
  return value !== undefined && /[\t\n\f\r ]/.test(value);
}

function isNameTerminator(value: string | undefined): boolean {
  return (
    value === undefined ||
    isHtmlWhitespace(value) ||
    value === "/" ||
    value === ">" ||
    value === "="
  );
}
