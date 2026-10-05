import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

const sharedPathModule = path.normalize(
  "packages/viewer/src/navigation/routes.ts",
);
const reviewPathModule = path.normalize(
  "packages/viewer/src/navigation/review_snapshot.ts",
);
const manifestCaptureModule = path.normalize("src/review/component_compare.ts");
const temporaryReviewPathAllowlist = new Set([
  // Milestone 7 moves shell comparison selection to reviewSnapshotViewPath.
  path.normalize("packages/viewer/src/shell/comparison_selection.ts"),
]);
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

test("review-record snapshot consumers use reviewSnapshotViewPath", async () => {
  const violations: string[] = [];
  for (const file of await productionModules(".")) {
    const normalized = path.normalize(file);
    if (
      normalized === sharedPathModule ||
      normalized === reviewPathModule ||
      temporaryReviewPathAllowlist.has(normalized)
    )
      continue;
    violations.push(
      ...directSnapshotCalls(file, await fs.readFile(file, "utf8")),
    );
  }
  assert.deepEqual(violations, []);
});

test("the review snapshot guard recognizes import aliases and namespace calls", () => {
  for (const source of [
    "snapshotViewPath(side, record.path, view.viewport, view.colorScheme);",
    "import { snapshotViewPath as build } from '@mokly/viewer/data'; build(side, record.path, view.viewport, view.colorScheme);",
    "const { snapshotViewPath: build } = await import('@mokly/viewer/data'); build(side, record.path, view.viewport, view.colorScheme);",
    "paths.snapshotViewPath(side, record.path, view.viewport, view.colorScheme);",
    "paths['snapshotViewPath'](side, record.path, view.viewport, view.colorScheme);",
  ])
    assert.equal(directSnapshotCalls("consumer.ts", source).length, 1, source);
  assert.deepEqual(
    directSnapshotCalls(
      "consumer.ts",
      "reviewSnapshotViewPath(side, record, view);",
    ),
    [],
  );
});

function directSnapshotCalls(file: string, source: string): string[] {
  const syntax = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(file),
  );
  const names = new Set(["snapshotViewPath"]);
  const collect = (node: ts.Node): void => {
    if (
      (ts.isImportSpecifier(node) || ts.isBindingElement(node)) &&
      node.propertyName?.getText(syntax) === "snapshotViewPath" &&
      ts.isIdentifier(node.name)
    )
      names.add(node.name.text);
    ts.forEachChild(node, collect);
  };
  collect(syntax);
  const violations: string[] = [];
  const inspect = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const name = ts.isPropertyAccessExpression(expression)
        ? expression.name.text
        : ts.isElementAccessExpression(expression) &&
            ts.isStringLiteral(expression.argumentExpression)
          ? expression.argumentExpression.text
          : expression.getText(syntax);
      if (names.has(name)) {
        let owner: ts.Node | undefined = node.parent;
        while (owner && !ts.isFunctionDeclaration(owner)) owner = owner.parent;
        const manifestCapture =
          path.normalize(file) === manifestCaptureModule &&
          owner &&
          ts.isFunctionDeclaration(owner) &&
          owner.name?.text === "artifactViews";
        if (!manifestCapture) {
          const line = syntax.getLineAndCharacterOfPosition(
            node.getStart(),
          ).line;
          violations.push(`${file}:${line + 1}`);
        }
      }
    }
    ts.forEachChild(node, inspect);
  };
  inspect(syntax);
  return violations;
}

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
