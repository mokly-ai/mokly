/** Decode source escapes for marker detection without CSS parsing or serialization. */
export function decodeCssEscapes(source: string): string {
  if (!source.includes("\\")) return source;
  const pieces: string[] = [];
  let copied = 0;
  let cursor = 0;
  let quote = "";
  let identifier = "";
  let prefixed = false;
  let url = false;
  while (cursor < source.length) {
    const character = source[cursor]!;
    if (!quote && !url && source.startsWith("/*", cursor)) {
      const end = source.indexOf("*/", cursor + 2);
      cursor = end < 0 ? source.length : end + 2;
      identifier = "";
      prefixed = false;
      continue;
    }
    if (character === "\\") {
      const newline = /[\n\r\f]/.test(source[cursor + 1] ?? "");
      const escaped = escapeAt(source, cursor, Boolean(quote));
      pieces.push(source.slice(copied, cursor), escaped.value);
      cursor = copied = escaped.end;
      if (!quote && !url) {
        if (newline) {
          identifier = "";
          prefixed = false;
        } else identifier = (identifier + escaped.value).slice(0, 4);
      }
      continue;
    }
    if (url) {
      if (character === ")") url = false;
    } else if (quote) {
      if (character === quote || /[\n\r\f]/.test(character)) quote = "";
    } else if (character === '"' || character === "'") {
      quote = character;
      identifier = "";
      prefixed = false;
    } else if (character === "(") {
      let next = cursor + 1;
      while (isWhitespace(source[next])) next++;
      url =
        !prefixed &&
        /^[uU][rR][lL]$/.test(identifier) &&
        source[next] !== '"' &&
        source[next] !== "'";
      identifier = "";
      prefixed = false;
    } else if (character === "\0" || /[-\w\u0080-\uffff]/.test(character)) {
      identifier = (identifier + character).slice(0, 4);
    } else {
      identifier = "";
      prefixed = character === "#" || character === "@";
    }
    cursor++;
  }
  pieces.push(source.slice(copied));
  return pieces.join("");
}

function escapeAt(source: string, start: number, inString: boolean) {
  let end = start + 1;
  if (end === source.length) return { end, value: "\ufffd" };
  if (inString && /[\n\r\f]/.test(source[end]!))
    return { end: end + (source.startsWith("\r\n", end) ? 2 : 1), value: "" };
  while (end < start + 7 && /[a-fA-F0-9]/.test(source[end] ?? "")) end++;
  if (end > start + 1) {
    const code = Number.parseInt(source.slice(start + 1, end), 16);
    if (isWhitespace(source[end]))
      end += source.startsWith("\r\n", end) ? 2 : 1;
    return { end, value: codePoint(code) };
  }
  const code = source.codePointAt(end)!;
  return { end: end + (code > 0xffff ? 2 : 1), value: codePoint(code) };
}

function codePoint(code: number): string {
  return String.fromCodePoint(
    code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
      ? 0xfffd
      : code,
  );
}

function isWhitespace(character: string | undefined): boolean {
  return character !== undefined && /[\t\n\f\r ]/.test(character);
}
