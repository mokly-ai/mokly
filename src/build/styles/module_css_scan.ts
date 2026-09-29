/** Classification of each authored CSS character after escape consumption. */
export const CSS_NORMAL = 0;
export const CSS_WHITESPACE = 1;
export const CSS_COMMENT = 2;
export const CSS_STRING = 3;
export const CSS_ESCAPE = 4;

export interface HexEscape {
  readonly start: number;
  readonly end: number;
  readonly digits: number;
  readonly terminatorStart?: number;
}

export interface CssComment {
  readonly start: number;
  readonly end: number;
}

export interface CssScan {
  readonly text: string;
  readonly kinds: Uint8Array;
  readonly hexEscapes: readonly HexEscape[];
  readonly comments: readonly CssComment[];
  readonly unclosedComment: boolean;
}

/** CSS whitespace is ASCII-only, unlike JavaScript's whitespace class. */
export function isCssWhitespaceCharacter(
  character: string | undefined,
): boolean {
  return (
    character === " " ||
    character === "\t" ||
    character === "\n" ||
    character === "\r" ||
    character === "\f"
  );
}

export function cssWhitespaceAt(scan: CssScan, index: number): boolean {
  return scan.kinds[index] === CSS_WHITESPACE;
}

export function cssWhitespaceOnly(text: string): boolean {
  if (!text) return true;
  return scanCssText(text).kinds.every((kind) => kind === CSS_WHITESPACE);
}

export function trimCssWhitespace(text: string): string {
  const scan = scanCssText(text);
  let start = 0;
  let end = text.length;
  while (start < end && cssWhitespaceAt(scan, start)) start += 1;
  while (end > start && cssWhitespaceAt(scan, end - 1)) end -= 1;
  return text.slice(start, end);
}

/** Scan forward so nested comment openers never move the true comment end. */
export function scanCssText(text: string): CssScan {
  const kinds = new Uint8Array(text.length);
  const hexEscapes: HexEscape[] = [];
  const comments: CssComment[] = [];
  let unclosedComment = false;
  for (let index = 0; index < text.length;) {
    const character = text[index]!;
    if (character === "/" && text[index + 1] === "*") {
      const closing = text.indexOf("*/", index + 2);
      const end = closing < 0 ? text.length : closing + 2;
      kinds.fill(CSS_COMMENT, index, end);
      comments.push({ start: index, end });
      if (closing < 0) unclosedComment = true;
      index = end;
      continue;
    }
    if (character === '"' || character === "'") {
      const start = index;
      index += 1;
      while (index < text.length) {
        if (text[index] === "\\") index += Math.min(2, text.length - index);
        else if (text[index++] === character) break;
      }
      kinds.fill(CSS_STRING, start, index);
      continue;
    }
    if (character === "\\") {
      const start = index;
      index += 1;
      let digits = 0;
      while (digits < 6 && isHexDigit(text[index])) {
        index += 1;
        digits += 1;
      }
      if (digits) {
        const terminatorStart = isCssWhitespaceCharacter(text[index])
          ? index
          : undefined;
        if (terminatorStart !== undefined)
          index += text[index] === "\r" && text[index + 1] === "\n" ? 2 : 1;
        kinds.fill(CSS_ESCAPE, start, index);
        hexEscapes.push({
          start,
          end: index,
          digits,
          ...(terminatorStart === undefined ? {} : { terminatorStart }),
        });
      } else {
        if (index < text.length) index += 1;
        kinds.fill(CSS_ESCAPE, start, index);
      }
      continue;
    }
    if (isCssWhitespaceCharacter(character)) kinds[index] = CSS_WHITESPACE;
    index += 1;
  }
  return { text, kinds, hexEscapes, comments, unclosedComment };
}

function isHexDigit(character: string | undefined): boolean {
  return character !== undefined && /^[0-9a-fA-F]$/u.test(character);
}
