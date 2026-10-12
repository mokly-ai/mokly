/** Scan normalized UTF-16 boundaries without attempting to validate CSS. */
import { decodeCssIdentifier, normalizeCssSource } from "./source.js";

export interface CssSegment {
  start: number;
  end: number;
}

export type CssSegmentScan =
  | { status: "segmented"; source: string; segments: readonly CssSegment[] }
  | { status: "anomaly" };

export function scanCssSegments(input: string): CssSegmentScan {
  try {
    return scan(normalizeCssSource(input));
  } catch {
    return { status: "anomaly" };
  }
}

function scan(source: string): CssSegmentScan {
  const segments: CssSegment[] = [];
  const stack: number[] = [];
  let start = -1;
  let offset = 0;
  const anomaly = { status: "anomaly" } as const;
  while (offset < source.length) {
    const code = source.charCodeAt(offset);
    if (whitespace(code)) {
      offset++;
      continue;
    }
    if (source.startsWith("/*", offset)) {
      const end = source.indexOf("*/", offset + 2);
      if (end < 0) return anomaly;
      offset = end + 2;
      continue;
    }
    if (!stack.length && source.startsWith("<!--", offset)) {
      if (word(source.charCodeAt(offset + 4))) return anomaly;
      if (start < 0) {
        offset += 4;
        continue;
      }
    }
    if (start < 0 && source.startsWith("-->", offset)) {
      offset += 3;
      continue;
    }
    if (start < 0) start = offset;
    if (code === 34 || code === 39) {
      const quote = code;
      offset++;
      while (offset < source.length && source.charCodeAt(offset) !== quote) {
        offset =
          source.charCodeAt(offset) === 92
            ? escapeEnd(source, offset)
            : offset + 1;
        if (offset < 0) return anomaly;
      }
      if (offset >= source.length) return anomaly;
      offset++;
      continue;
    }
    if (word(code)) {
      const wordStart = offset;
      while (offset < source.length && word(source.charCodeAt(offset))) {
        offset =
          source.charCodeAt(offset) === 92
            ? escapeEnd(source, offset)
            : offset + 1;
        if (offset < 0) return anomaly;
      }
      if (
        source.charCodeAt(offset) === 40 &&
        ![0, 35, 64].includes(source.charCodeAt(wordStart - 1)) &&
        decodeCssIdentifier(source.slice(wordStart, offset)).toLowerCase() ===
          "url"
      ) {
        let body = offset + 1;
        while (whitespace(source.charCodeAt(body))) body++;
        if (source.charCodeAt(body) !== 34 && source.charCodeAt(body) !== 39) {
          offset = body;
          while (offset < source.length && source.charCodeAt(offset) !== 41) {
            offset =
              source.charCodeAt(offset) === 92
                ? escapeEnd(source, offset)
                : offset + 1;
            if (offset < 0) return anomaly;
          }
          if (offset >= source.length) return anomaly;
          offset++;
        }
      }
      continue;
    }
    if (code === 40 || code === 91 || code === 123) stack.push(code);
    else if (code === 41 || code === 93 || code === 125) {
      const opening = stack.pop();
      if (opening !== (code === 41 ? 40 : code === 93 ? 91 : 123))
        return anomaly;
      if (!stack.length && code === 125) {
        segments.push({ start, end: offset + 1 });
        start = -1;
      }
    } else if (!stack.length && code === 59) {
      segments.push({ start, end: offset + 1 });
      start = -1;
    }
    offset++;
  }
  return stack.length || start >= 0
    ? anomaly
    : { status: "segmented", source, segments };
}

function word(code: number): boolean {
  return (
    code >= 128 ||
    code === 45 ||
    code === 92 ||
    code === 95 ||
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122)
  );
}

function whitespace(code: number): boolean {
  return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function escapeEnd(source: string, start: number): number {
  if (start + 1 >= source.length) return -1;
  let end = start + 1;
  while (end < start + 7 && hex(source.charCodeAt(end))) end++;
  if (end === start + 1) return end + 1;
  return whitespace(source.charCodeAt(end)) ? end + 1 : end;
}

function hex(code: number): boolean {
  return (
    (code >= 48 && code <= 57) ||
    (code >= 65 && code <= 70) ||
    (code >= 97 && code <= 102)
  );
}
