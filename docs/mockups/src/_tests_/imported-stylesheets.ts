/**
 * The CSS that a catalogue module imports, read from the authored sources.
 * Mokly bundles the CSS that an entry module reaches into one stylesheet, in
 * the first-reachability depth-first order of the JavaScript imports
 * (`docs/protocol/mokly-imported-styles.md`). This reader walks the same
 * graph over the relative imports, so a test reads the source sheets of an
 * entry's bundle in its order, not the bundle that `lightningcss` reprints.
 */

import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

import ts from "typescript";

/** The relative imports of each module read so far, by absolute path. */
const parsed = new Map<string, readonly string[]>();

/**
 * The specifier of one statement that loads a module: an import or a
 * re-export. A type-only import loads no module, so it has none.
 */
function loadedSpecifier(node: ts.Statement): string | undefined {
  const specifier =
    ts.isImportDeclaration(node) && node.importClause?.isTypeOnly !== true
      ? node.moduleSpecifier
      : ts.isExportDeclaration(node) && !node.isTypeOnly
        ? node.moduleSpecifier
        : undefined;
  return specifier && ts.isStringLiteral(specifier)
    ? specifier.text
    : undefined;
}

/** The relative specifiers that one module loads, in statement order. */
function relativeImports(modulePath: string): readonly string[] {
  const known = parsed.get(modulePath);
  if (known !== undefined) return known;
  const source = ts.createSourceFile(
    modulePath,
    readFileSync(modulePath, "utf8"),
    ts.ScriptTarget.Latest,
    false,
    modulePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = source.statements
    .map(loadedSpecifier)
    .filter((specifier): specifier is string => !!specifier?.startsWith("."));
  parsed.set(modulePath, specifiers);
  return specifiers;
}

/**
 * The file that one relative module specifier names: the path itself, or a
 * TypeScript source in place of a `.js` specifier or without an extension.
 */
function moduleFile(importer: string, specifier: string): string {
  const path = resolve(dirname(importer), specifier);
  const stem = path.replace(/\.js$/, "");
  const file = [
    path,
    stem + ".ts",
    stem + ".tsx",
    path + ".tsx",
    path + ".ts",
  ].find((candidate) =>
    statSync(candidate, { throwIfNoEntry: false })?.isFile(),
  );
  assert.ok(file, `${importer} imports ${specifier}, which names no module`);
  return file;
}

/**
 * The stylesheets that one module reaches through its relative imports, as
 * absolute paths, each at its first reach. A JSON module imports nothing.
 */
export function importedStylesheets(entry: string): string[] {
  const sheets: string[] = [];
  const visited = new Set<string>();
  const visit = (modulePath: string): void => {
    visited.add(modulePath);
    for (const specifier of relativeImports(modulePath)) {
      if (specifier.endsWith(".css")) {
        const sheet = resolve(dirname(modulePath), specifier);
        if (!sheets.includes(sheet)) sheets.push(sheet);
      } else if (!specifier.endsWith(".json")) {
        const file = moduleFile(modulePath, specifier);
        if (!visited.has(file)) visit(file);
      }
    }
  };
  visit(entry);
  return sheets;
}
