import { isAsciiWhitespace } from "./presentation_url.js";

export interface CssToken {
  end: number;
  value?: string;
}

export function skipWhitespace(source: string, position: number): number {
  while (isAsciiWhitespace(source.charAt(position))) position += 1;
  return position;
}

export function commentEnd(source: string, start: number): number {
  const close = source.indexOf("*/", start + 2);
  return close === -1 ? source.length : close + 2;
}

export function isQuote(character: string): boolean {
  return character === '"' || character === "'";
}

function isNewline(character: string): boolean {
  return character === "\n" || character === "\r" || character === "\f";
}

function whitespaceWidth(source: string, position: number): number {
  return source.startsWith("\r\n", position) ? 2 : 1;
}

function isEscape(source: string, position: number): boolean {
  return source[position] === "\\" && !isNewline(source.charAt(position + 1));
}

function scalar(codePoint: number): string {
  return codePoint === 0 ||
    codePoint > 0x10ffff ||
    (codePoint >= 0xd800 && codePoint <= 0xdfff)
    ? "\ufffd"
    : String.fromCodePoint(codePoint);
}

function readEscape(source: string, slash: number) {
  const start = slash + 1;
  let end = start;
  while (end < start + 6 && /[0-9A-Fa-f]/.test(source.charAt(end))) end += 1;
  if (end > start) {
    const value = scalar(Number.parseInt(source.slice(start, end), 16));
    if (isAsciiWhitespace(source.charAt(end)))
      end += whitespaceWidth(source, end);
    return { end, value };
  }
  const codePoint = source.codePointAt(start);
  if (codePoint === undefined) return { end, value: "\ufffd" };
  return {
    end: start + (codePoint > 0xffff ? 2 : 1),
    value: scalar(codePoint),
  };
}

/** Apply CSS input preprocessing to the contents of a token. */
function preprocessed(value: string): string {
  return value
    .replaceAll("\0", "\ufffd")
    .replace(/[\uD800-\uDFFF]/gu, "\ufffd");
}

export function isName(source: string, position: number): boolean {
  const codePoint = source.charCodeAt(position);
  return (
    codePoint === 0 ||
    codePoint >= 0x80 ||
    /[A-Za-z0-9_-]/.test(source.charAt(position)) ||
    isEscape(source, position)
  );
}

export function readName(source: string, start: number) {
  let end = start;
  let value = "";
  while (isName(source, end)) {
    if (source[end] === "\\") {
      const escape = readEscape(source, end);
      end = escape.end;
      value += escape.value;
    } else {
      value += source.charAt(end++);
    }
  }
  return { end, value: preprocessed(value) };
}

export function readString(source: string, start: number): CssToken {
  const quote = source[start];
  let value = "";
  let end = start + 1;
  while (end < source.length) {
    const character = source.charAt(end);
    if (character === quote)
      return { end: end + 1, value: preprocessed(value) };
    if (isNewline(character)) return { end };
    if (character === "\\") {
      const next = source.charAt(end + 1);
      if (next === "") break;
      if (isNewline(next)) {
        end += 1 + whitespaceWidth(source, end + 1);
        continue;
      }
      const escape = readEscape(source, end);
      end = escape.end;
      value += escape.value;
    } else {
      value += character;
      end += 1;
    }
  }
  return { end: source.length, value: preprocessed(value) };
}

export function readUnquotedUrl(source: string, start: number): CssToken {
  let end = start;
  let value = "";
  while (end < source.length) {
    const character = source.charAt(end);
    if (character === ")" || isAsciiWhitespace(character)) break;
    if (isEscape(source, end)) {
      const escape = readEscape(source, end);
      end = escape.end;
      value += escape.value;
      continue;
    }
    if (
      isQuote(character) ||
      character === "(" ||
      character === "\\" ||
      isNonPrintable(source.charCodeAt(end))
    )
      return badUrl(source, end);
    value += character;
    end += 1;
  }
  end = skipWhitespace(source, end);
  if (source[end] === ")") end += 1;
  else if (end < source.length) return badUrl(source, end);
  return { end, value: preprocessed(value) };
}

function isNonPrintable(codePoint: number): boolean {
  return (
    (codePoint > 0 && codePoint < 9) ||
    codePoint === 11 ||
    (codePoint >= 14 && codePoint <= 31) ||
    codePoint === 127
  );
}

function badUrl(source: string, position: number): CssToken {
  while (position < source.length) {
    if (source[position] === ")") return { end: position + 1 };
    position = isEscape(source, position)
      ? readEscape(source, position).end
      : position + 1;
  }
  return { end: position };
}
