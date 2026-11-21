/** Resolve catalogue resource paths and rebase stylesheet references. */

import path from "node:path";

/** Marks linked stylesheets that the stage publishes inline. */
export const INLINED_STYLESHEET_ATTRIBUTE = "data-inlined-stylesheet";

const CSS_WHITESPACE = /[\t\n\f\r ]/;
const CSS_NAME_CHARACTER = /[\w-]/;
const UNQUOTED_URL_CHARACTER = /[^\t\n\f\r "'()]/;

/** Whether the stage publishes the reference with the document. */
export function local(reference: string): boolean {
  return (
    reference.length > 0 &&
    !reference.startsWith("#") &&
    !/^[a-z][a-z0-9+.-]*:/i.test(reference) &&
    !reference.startsWith("//")
  );
}

/** Resolve a reference to a catalogue-relative path. */
export function resolve(source: string, reference: string): string {
  const [target] = reference.split("#");
  if (target?.startsWith("/")) return path.posix.normalize(target.slice(1));
  return path.posix.normalize(
    path.posix.join(path.posix.dirname(source), target ?? ""),
  );
}

/** Resolve a resource path and check that it stays inside the catalogue output. */
export function safeTarget(source: string, reference: string): string {
  const target = resolve(source, reference);
  if (
    target === ".." ||
    target.startsWith("../") ||
    path.posix.isAbsolute(target)
  ) {
    throw new Error(
      `${source}: the stage resource ${JSON.stringify(reference)} escapes the catalogue output`,
    );
  }
  return target;
}

interface StylesheetReference {
  readonly start: number;
  readonly end: number;
  readonly value: string;
  readonly imported: boolean;
}

interface CssFunction {
  readonly name: string;
  readonly blockDepth: number;
}

function skipWhitespace(css: string, offset: number): number {
  while (CSS_WHITESPACE.test(css[offset] ?? "")) offset += 1;
  return offset;
}

function skipTrivia(css: string, offset: number): number {
  offset = skipWhitespace(css, offset);
  while (css.startsWith("/*", offset)) {
    const end = css.indexOf("*/", offset + 2);
    if (end < 0) return css.length;
    offset = skipWhitespace(css, end + 2);
  }
  return offset;
}

function isQuote(character: string | undefined): boolean {
  return character === '"' || character === "'";
}

function closingQuote(css: string, start: number): number | undefined {
  const quote = css[start];
  for (let offset = start + 1; offset < css.length; offset += 1) {
    if (css[offset] === quote) return offset;
    if (css[offset] === "\\") offset += 1;
  }
  return undefined;
}

function urlSpan(css: string, opening: number) {
  const value = skipWhitespace(css, opening + 1);
  const quoted = isQuote(css[value]);
  const start = quoted ? value + 1 : value;
  let end = quoted ? closingQuote(css, value) : start;
  if (end === undefined) return undefined;
  if (!quoted) {
    while (UNQUOTED_URL_CHARACTER.test(css[end] ?? "")) end += 1;
  }
  const close = quoted ? skipTrivia(css, end + 1) : skipWhitespace(css, end);
  if (css[close] !== ")") return undefined;
  return { start, end, next: close + 1 };
}

/** Scan reference spans so rebasing preserves the surrounding CSS. */
function stylesheetReferences(css: string): StylesheetReference[] {
  const references: StylesheetReference[] = [];
  const functions: CssFunction[] = [];
  const names = /@?[\w-]+/y;
  let blockDepth = 0;
  let pendingImport: "top-level" | "nested" | undefined;
  let offset = 0;

  function add(start: number, end: number, imported: boolean): void {
    const value = css.slice(start, end);
    if (local(value)) references.push({ start, end, value, imported });
  }

  while (offset < css.length) {
    offset = skipTrivia(css, offset);
    if (offset === css.length) break;
    const character = css[offset];
    const importing = pendingImport;
    pendingImport = undefined;

    if (isQuote(character)) {
      const end = closingQuote(css, offset);
      if (end === undefined) break;
      const parent = functions.at(-1);
      const imageSet =
        parent?.blockDepth === blockDepth &&
        (parent.name === "image-set" || parent.name === "-webkit-image-set");
      if (importing === "top-level" || (importing === undefined && imageSet)) {
        add(offset + 1, end, importing === "top-level");
      }
      offset = end + 1;
      continue;
    }

    names.lastIndex = offset;
    const name = names.exec(css)?.[0].toLowerCase();
    if (name === undefined) {
      switch (character) {
        case "{":
          blockDepth += 1;
          break;
        case "}":
          blockDepth = Math.max(0, blockDepth - 1);
          break;
        case "(":
          functions.push({ name: "", blockDepth });
          break;
        case ")":
          functions.pop();
          break;
        case "\\":
          offset += 1;
          break;
      }
      offset += 1;
      continue;
    }

    const previous = css[offset - 1] ?? "";
    offset = names.lastIndex;
    if (name === "@import") {
      pendingImport =
        blockDepth === 0 && functions.length === 0 ? "top-level" : "nested";
      continue;
    }
    if (name.startsWith("@") || css[offset] !== "(") continue;

    if (name === "url" && !CSS_NAME_CHARACTER.test(previous)) {
      const url = urlSpan(css, offset);
      if (url) {
        if (importing !== "nested") {
          add(url.start, url.end, importing === "top-level");
        }
        offset = url.next;
        continue;
      }
    }
    functions.push({ name, blockDepth });
    offset += 1;
  }
  return references;
}

/** Local resources referenced by a stylesheet, resolved from catalogue root. */
export function stylesheetResources(
  source: string,
  css: string,
): readonly string[] {
  const imports: string[] = [];
  const urls: string[] = [];
  for (const { value, imported } of stylesheetReferences(css)) {
    const references = imported ? imports : urls;
    references.push(value);
  }
  return [...new Set([...imports, ...urls])].map((value) =>
    safeTarget(source, value),
  );
}

/** Rewrite only the local reference spans for a stylesheet moved to stage root. */
export function rebaseStylesheet(source: string, css: string): string {
  let rebased = "";
  let offset = 0;
  for (const { start, end, value } of stylesheetReferences(css)) {
    const fragmentStart = value.indexOf("#");
    const fragment = fragmentStart < 0 ? "" : value.slice(fragmentStart);
    rebased += `${css.slice(offset, start)}./${safeTarget(source, value)}${fragment}`;
    offset = end;
  }
  return rebased + css.slice(offset);
}
