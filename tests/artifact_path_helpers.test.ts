import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

const sharedPathModule = path.normalize(
  "packages/viewer/src/navigation/routes.ts",
);
const moduleExtensions = new Set([
  ".cjs",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".mts",
  ".ts",
  ".tsx",
]);
const excludedDirectories = new Set([
  ".context",
  ".git",
  ".mokly-cache",
  "coverage",
  "dist",
  "docs",
  "generated",
  "node_modules",
  "plans",
  "playwright-report",
  "target",
  "test-results",
  "tests",
]);

test("production modules use the shared comparison artifact path builders", async () => {
  const violations: string[] = [];
  for (const file of await productionModules(".")) {
    if (path.normalize(file) === sharedPathModule) continue;
    const source = await fs.readFile(file, "utf8");
    const syntax = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind(file),
    );
    const inspect = (node: ts.Node): void => {
      if (ts.isStringLiteralLike(node) || ts.isTemplateExpression(node)) {
        const literal = source.slice(node.getStart(syntax), node.getEnd());
        if (
          literal.includes("snapshots/") ||
          /pages\/[\s\S]*\.json/u.test(literal)
        ) {
          const line = syntax.getLineAndCharacterOfPosition(
            node.getStart(),
          ).line;
          violations.push(`${file}:${line + 1}`);
        }
      }
      ts.forEachChild(node, inspect);
    };
    inspect(syntax);
  }
  assert.deepEqual(violations, []);
});

async function productionModules(directory: string): Promise<string[]> {
  const modules: string[] = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory())
      modules.push(...(await productionModules(candidate)));
    else if (entry.isFile() && moduleExtensions.has(path.extname(entry.name)))
      modules.push(candidate.replace(/^\.\//u, ""));
  }
  return modules.sort();
}

function scriptKind(file: string): ts.ScriptKind {
  if (/\.[cm]?tsx$/u.test(file) || file.endsWith(".jsx"))
    return ts.ScriptKind.TSX;
  if (/\.[cm]?ts$/u.test(file)) return ts.ScriptKind.TS;
  if (/\.[cm]?js$/u.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}
