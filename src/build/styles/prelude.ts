/** A syntactically complete @import in the initial CSS import prelude. */
export interface PreludeImport {
  readonly start: number;
  readonly end: number;
  readonly specifier: string;
}

/** Tokenize the initial CSS prelude, retaining exact rule offsets for pruning. */
export function scanImportPrelude(css: string): PreludeImport[] {
  const imports: PreludeImport[] = [];
  let cursor = 0;
  while (cursor < css.length) {
    cursor = skipTrivia(css, cursor);
    if (css[cursor] !== "@") break;
    const start = cursor;
    cursor++;
    const nameStart = cursor;
    while (/[\w-]/.test(css[cursor] ?? "")) cursor++;
    const name = css.slice(nameStart, cursor).toLowerCase();
    if (name !== "import" && name !== "charset" && name !== "layer") break;
    cursor = skipTrivia(css, cursor);
    let specifier: string | undefined;
    if (name === "import") {
      if (css[cursor] === '"' || css[cursor] === "'") {
        const token = readString(css, cursor);
        specifier = token.value;
        cursor = token.end;
      } else if (css.slice(cursor, cursor + 4).toLowerCase() === "url(") {
        cursor = skipTrivia(css, cursor + 4);
        if (css[cursor] === '"' || css[cursor] === "'") {
          const token = readString(css, cursor);
          specifier = token.value;
          cursor = skipTrivia(css, token.end);
        } else {
          const token = readUnquotedUrl(css, cursor);
          specifier = token.value;
          cursor = token.end;
        }
        if (css[cursor] !== ")") break;
        cursor++;
      } else break;
    }
    const end = ruleEnd(css, cursor);
    if (end === undefined) break;
    if (name === "import" && specifier !== undefined)
      imports.push({ start, end, specifier });
    cursor = end;
  }
  return imports;
}

function skipTrivia(css: string, from: number): number {
  let cursor = from;
  while (cursor < css.length) {
    if (/\s/.test(css[cursor]!)) cursor++;
    else if (css.slice(cursor, cursor + 2) === "/*") {
      const end = css.indexOf("*/", cursor + 2);
      cursor = end < 0 ? css.length : end + 2;
    } else break;
  }
  return cursor;
}

function readString(
  css: string,
  start: number,
): { value: string; end: number } {
  const quote = css[start];
  let cursor = start + 1;
  let value = "";
  while (cursor < css.length && css[cursor] !== quote) {
    if (css[cursor] === "\\") {
      const escape = readEscape(css, cursor);
      value += escape.value;
      cursor = escape.end;
    } else value += css[cursor++]!;
  }
  return { value, end: cursor < css.length ? cursor + 1 : cursor };
}

function readEscape(
  css: string,
  start: number,
): { value: string; end: number } {
  let cursor = start + 1;
  let digits = "";
  while (
    cursor < css.length &&
    digits.length < 6 &&
    /[0-9a-f]/i.test(css[cursor]!)
  )
    digits += css[cursor++]!;
  if (digits) {
    if (/\s/.test(css[cursor] ?? "")) cursor++;
    const codepoint = Number.parseInt(digits, 16);
    return {
      value: String.fromCodePoint(
        codepoint > 0x10ffff || codepoint === 0 ? 0xfffd : codepoint,
      ),
      end: cursor,
    };
  }
  return { value: css[cursor] ?? "", end: Math.min(cursor + 1, css.length) };
}

function readUnquotedUrl(
  css: string,
  start: number,
): { value: string; end: number } {
  let cursor = start;
  let value = "";
  while (cursor < css.length && css[cursor] !== ")") {
    if (css[cursor] === "\\") {
      const escape = readEscape(css, cursor);
      value += escape.value;
      cursor = escape.end;
    } else value += css[cursor++]!;
  }
  return { value: value.trim(), end: cursor };
}

function ruleEnd(css: string, from: number): number | undefined {
  let depth = 0;
  let cursor = from;
  while (cursor < css.length) {
    if (css.slice(cursor, cursor + 2) === "/*") {
      cursor = skipTrivia(css, cursor);
      continue;
    }
    if (css[cursor] === '"' || css[cursor] === "'") {
      cursor = readString(css, cursor).end;
      continue;
    }
    if (css[cursor] === "\\") {
      cursor = readEscape(css, cursor).end;
      continue;
    }
    if (css[cursor] === "(") depth++;
    else if (css[cursor] === ")") depth--;
    else if (css[cursor] === "{" && depth === 0) return;
    else if (css[cursor] === ";" && depth === 0) return cursor + 1;
    cursor++;
  }
  return;
}
