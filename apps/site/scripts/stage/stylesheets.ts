/** Resolve catalogue resource paths and rebase stylesheet references. */

import path from "node:path";

const CSS_STRING = String.raw`"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'`;
const CSS_REFERENCES = new RegExp(
  [
    String.raw`@import[\t\n\f\r ]+(?<quotedImport>${CSS_STRING})`,
    String.raw`(?<![\w-])url\([\t\n\f\r ]*(?<url>${CSS_STRING}|[^\t\n\f\r "'()]+)[\t\n\f\r ]*\)`,
    // Consume comments and other strings so their contents stay untouched.
    String.raw`/\*[\s\S]*?\*/`,
    CSS_STRING,
  ].join("|"),
  "dgi",
);

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

function stylesheetReferences(css: string) {
  const references = [];
  for (const { indices } of css.matchAll(CSS_REFERENCES)) {
    const quotedImport = indices?.groups?.quotedImport;
    const range = quotedImport ?? indices?.groups?.url;
    if (!range) continue;
    let [start, end] = range;
    if (css[start] === '"' || css[start] === "'") {
      start += 1;
      end -= 1;
    }
    const value = css.slice(start, end);
    if (local(value)) {
      references.push({
        start,
        end,
        value,
        imported: quotedImport !== undefined,
      });
    }
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
