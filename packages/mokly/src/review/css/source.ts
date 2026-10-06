/** Tokenize CSS boundaries and recover ordered rule bodies from the original source. */
import type { Location2 } from "lightningcss";

import { CssRuleParseError } from "./types.js";

/** Source tokens are used only for boundaries and trivia, never CSS validation. */
export interface CssSourceToken {
  value: string;
  start: number;
  end: number;
  spaceBefore: boolean;
  commentBefore: boolean;
  word: boolean;
}

/** A source rule's header and optional braced body. */
export interface CssSourceRule {
  header: string;
  end: number;
  body?: { start: number; end: number };
}

/** Preserve source declaration order, which Lightning CSS's AST does not retain. */
export class CssSource {
  readonly tokens: readonly CssSourceToken[];
  private readonly lines = [0];
  private readonly closings = new Map<number, number>();

  constructor(readonly text: string) {
    this.tokens = tokenizeCss(text);
    for (let index = 0; index < text.length; index += 1)
      if (text[index] === "\n") this.lines.push(index + 1);
    const opened: number[] = [];
    for (let index = 0; index < this.tokens.length; index += 1) {
      const value = this.tokens[index]!.value;
      if (["{", "(", "["].includes(value)) opened.push(index);
      if (["}", ")", "]"].includes(value)) {
        const opening = opened.pop();
        if (
          opening === undefined ||
          "{([".indexOf(this.tokens[opening]!.value) !== "})]".indexOf(value)
        )
          throw new CssRuleParseError({
            kind: "unbalanced-block",
            offset: this.tokens[index]!.start,
          });
        this.closings.set(opening, index);
      }
    }
    if (opened.length) throw new CssRuleParseError({ kind: "unclosed-block" });
  }

  offset(location: Location2): number {
    const line = this.lines[location.line];
    if (line === undefined)
      throw new CssRuleParseError({ kind: "invalid-location", location });
    return line + location.column - 1;
  }

  rule(start: number): CssSourceRule {
    for (
      let index = this.tokenIndex(start);
      index < this.tokens.length;
      index += 1
    ) {
      const token = this.tokens[index]!;
      if (token.value === ";")
        return { header: this.text.slice(start, token.start), end: token.end };
      if (token.value === "{") {
        const end = this.tokens[this.closing(index)]!;
        return {
          header: this.text.slice(start, token.start),
          body: { start: token.end, end: end.start },
          end: end.end,
        };
      }
      if (token.value === "(" || token.value === "[")
        index = this.closing(index);
    }
    return { header: this.text.slice(start), end: this.text.length };
  }

  closing(index: number): number {
    const closing = this.closings.get(index);
    if (closing === undefined)
      throw new CssRuleParseError({ kind: "missing-block", index });
    return closing;
  }

  private tokenIndex(offset: number): number {
    let low = 0;
    let high = this.tokens.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (this.tokens[middle]!.start < offset) low = middle + 1;
      else high = middle;
    }
    return low;
  }
}

/** Tokenize CSS boundaries; resource discovery may retain a valid prefix of incomplete source. */
export function tokenizeCss(
  text: string,
  options: { allowIncomplete?: boolean } = {},
): CssSourceToken[] {
  const tokens: CssSourceToken[] = [];
  let offset = 0;
  let spaceBefore = false;
  let commentBefore = false;
  try {
    while (offset < text.length) {
      if (/[\t\n\f\r ]/.test(text[offset]!)) {
        spaceBefore = true;
        offset += 1;
        continue;
      }
      if (text.startsWith("/*", offset)) {
        const end = text.indexOf("*/", offset + 2);
        if (end < 0)
          throw new CssRuleParseError({ kind: "unclosed-comment", offset });
        offset = end + 2;
        commentBefore = true;
        continue;
      }
      const start = offset;
      const character = text[offset]!;
      const word = isWord(character);
      let value: string | undefined;
      if (character === '"' || character === "'") {
        offset += 1;
        while (offset < text.length && text[offset] !== character)
          offset = text[offset] === "\\" ? escapeEnd(text, offset) : offset + 1;
        if (offset === text.length)
          throw new CssRuleParseError({
            kind: "unclosed-string",
            offset: start,
          });
        offset += 1;
      } else if (word) {
        while (offset < text.length && isWord(text[offset]!))
          offset = text[offset] === "\\" ? escapeEnd(text, offset) : offset + 1;
        const url = unquotedUrl(text, start, offset);
        if (url) {
          offset = url.end;
          value = url.value;
        }
      } else offset += 1;
      tokens.push({
        value: value ?? text.slice(start, offset),
        start,
        end: offset,
        spaceBefore,
        commentBefore,
        word: word && value === undefined,
      });
      spaceBefore = false;
      commentBefore = false;
    }
  } catch (error) {
    if (!options.allowIncomplete || !(error instanceof CssRuleParseError))
      throw error;
  }
  return tokens;
}

/** Decode an identifier at the native/source boundary, including escaped property names. */
export function decodeCssIdentifier(value: string): string {
  return value.replace(
    /\\([a-f\d]{1,6})[\t\n\f\r ]?|\\([^\n])/gi,
    (_match: string, hex: string | undefined, escaped: string | undefined) => {
      const code = hex ? Number.parseInt(hex, 16) : 0;
      return hex
        ? String.fromCodePoint(code > 0 && code <= 0x10ffff ? code : 0xfffd)
        : (escaped ?? "");
    },
  );
}

/** CSS URL tokens treat comment markers and braces as literal URL content. */
function unquotedUrl(
  text: string,
  start: number,
  wordEnd: number,
): { value: string; end: number } | undefined {
  if (
    text[wordEnd] !== "(" ||
    decodeCssIdentifier(text.slice(start, wordEnd)).toLowerCase() !== "url"
  )
    return undefined;
  let offset = wordEnd + 1;
  while (/[\t\n\f\r ]/.test(text[offset] ?? "")) offset += 1;
  if (text[offset] === '"' || text[offset] === "'") return undefined;
  const valueStart = offset;
  let valueEnd = offset;
  while (offset < text.length && text[offset] !== ")") {
    if (text[offset] === "\\") {
      offset = escapeEnd(text, offset);
      valueEnd = offset;
    } else {
      offset += 1;
      if (!/[\t\n\f\r ]/.test(text[offset - 1]!)) valueEnd = offset;
    }
  }
  if (offset === text.length)
    throw new CssRuleParseError({ kind: "unclosed-url", offset: start });
  return {
    value: `${text.slice(start, wordEnd)}(${text.slice(valueStart, valueEnd)})`,
    end: offset + 1,
  };
}

function isWord(character: string): boolean {
  return /[a-zA-Z0-9_\\-]/.test(character) || character.charCodeAt(0) >= 128;
}

function escapeEnd(text: string, start: number): number {
  let end = start + 1;
  while (end < start + 7 && /[a-fA-F0-9]/.test(text[end] ?? "")) end += 1;
  if (end === start + 1) return Math.min(end + 1, text.length);
  return /[\t\n\f\r ]/.test(text[end] ?? "") ? end + 1 : end;
}
