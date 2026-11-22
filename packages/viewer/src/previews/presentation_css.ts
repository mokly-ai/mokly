import {
  commentEnd,
  isName,
  isQuote,
  readName,
  readString,
  readUnquotedUrl,
  skipWhitespace,
  type CssToken,
} from "./presentation_css_tokens.js";
import { relativeAddress } from "./presentation_url.js";

interface CssBlock {
  close: string;
  imageSet: boolean;
  opaque: boolean;
  pendingImport: boolean;
}

interface CssUrl extends CssToken {
  suffix?: string;
}

/** Rewrite CSS URL tokens and the strings that name resource addresses. */
export function rewriteCss(source: string, base: string): string {
  const pieces: string[] = [];
  let copied = 0;
  const replace = (start: number, token: CssToken, urlSuffix?: string) => {
    if (token.value === undefined) return;
    const address = relativeAddress(token.value, base);
    if (address === undefined) return;
    const quoted = quote(address);
    pieces.push(
      source.slice(copied, start),
      urlSuffix === undefined ? quoted : `url(${quoted}${urlSuffix}`,
    );
    copied = token.end;
  };

  const blocks: CssBlock[] = [];
  let block = {
    close: "",
    imageSet: false,
    opaque: false,
    pendingImport: false,
  };
  const enter = (close: string, imageSet = false, opaque = block.opaque) => {
    blocks.push(block);
    block = { close, imageSet, opaque, pendingImport: false };
  };

  let position = 0;
  while (position < source.length) {
    const start = position;
    const character = source.charAt(start);
    if (source.startsWith("/*", start)) {
      position = commentEnd(source, start);
      continue;
    }
    if (source.startsWith("<!--", start)) {
      position += 4;
      continue;
    }
    if (isQuote(character)) {
      const token = readString(source, start);
      if (!block.opaque && (block.pendingImport || block.imageSet))
        replace(start, token);
      block.pendingImport = false;
      position = token.end;
      continue;
    }
    const prefix = character === "#" || character === "@" ? 1 : 0;
    if (isName(source, start + prefix)) {
      const name = readName(source, start + prefix);
      position = name.end;
      if (prefix) {
        if (character === "@" && /^import$/i.test(name.value))
          block.pendingImport = true;
        continue;
      }
      if (source[position] !== "(") continue;
      position += 1;
      if (/^url$/i.test(name.value)) {
        const url = readUrl(source, position);
        block.pendingImport = false;
        if (url) {
          if (!block.opaque) replace(start, url, url.suffix ?? ")");
          position = url.end;
        } else {
          enter(")", false, true);
        }
      } else {
        enter(")", /^(?:-webkit-)?image-set$/i.test(name.value));
      }
      continue;
    }
    if (character === ";" || character === "{") block.pendingImport = false;
    if (character === block.close) block = blocks.pop() ?? block;
    else if (character === "(") enter(")");
    else if (character === "[") enter("]");
    else if (character === "{") enter("}");
    position += 1;
  }
  return pieces.length ? pieces.join("") + source.slice(copied) : source;
}

function readUrl(source: string, position: number): CssUrl | undefined {
  const start = skipWhitespace(source, position);
  if (!isQuote(source.charAt(start))) return readUnquotedUrl(source, start);
  const token = readString(source, start);
  if (token.value === undefined) return;
  const first = skipWhitespace(source, token.end);
  let close = first;
  while (source.startsWith("/*", close))
    close = skipWhitespace(source, commentEnd(source, close));
  if (source[close] !== ")" && close < source.length) return;
  const end = close < source.length ? close + 1 : close;
  return {
    end,
    value: token.value,
    suffix: close === first ? ")" : source.slice(token.end, end),
  };
}

function quote(value: string): string {
  return `"${value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("\n", "\\a ")}"`;
}
