import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import ts from "typescript";

import { repositoryRoot } from "./helpers/fixture.js";

/**
 * Shell and embedded-viewer modules reach branch-point identities only through
 * the shared lookup. Reader validation under `catalogue/` and the hierarchy
 * builder under `registry/` own their own checks and are out of scope.
 */
const ROOTS = ["packages/viewer/src/shell", "packages/viewer/src/viewer"];
const LOOKUP = "packages/viewer/src/shell/catalogue_branch_point.ts";
const PATH_NAME = /^(path|entryId|parentId)$|Path$/;
const CASE_FOLDS = new Set([
  "toLowerCase",
  "toUpperCase",
  "toLocaleLowerCase",
  "toLocaleUpperCase",
]);

/** Name a property access, element access or binding reads, if any. */
function readName(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression)
  )
    return node.argumentExpression.text;
  return undefined;
}

/** A `variantOf` read may only test presence or be copied into a record. */
function permittedVariantRead(node: ts.Expression): boolean {
  const parent = node.parent;
  if (ts.isTypeOfExpression(parent)) return true;
  if (ts.isPropertyAssignment(parent) && parent.initializer === node)
    return true;
  if (
    ts.isBinaryExpression(parent) &&
    [
      ts.SyntaxKind.EqualsEqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsEqualsToken,
      ts.SyntaxKind.EqualsEqualsToken,
      ts.SyntaxKind.ExclamationEqualsToken,
    ].includes(parent.operatorToken.kind)
  ) {
    const other = parent.left === node ? parent.right : parent.left;
    return (
      (ts.isIdentifier(other) && other.text === "undefined") ||
      other.kind === ts.SyntaxKind.NullKeyword
    );
  }
  return false;
}

/** Whether a receiver names an entry path or path-valued identity. */
function pathReceiver(node: ts.Expression): boolean {
  const name = ts.isIdentifier(node) ? node.text : readName(node);
  return name !== undefined && PATH_NAME.test(name);
}

/** Every branch-point mapping a module performs outside the lookup. */
function branchPointViolations(source: ts.SourceFile): string[] {
  const violations: string[] = [];
  const report = (node: ts.Node, rule: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    violations.push(`${source.fileName}:${line + 1} ${rule}`);
  };
  const visit = (node: ts.Node): void => {
    const name = readName(node);
    if (name === "previousPaths") report(node, "reads previousPaths");
    if (name === "variantOf" && !permittedVariantRead(node as ts.Expression))
      report(node, "compares or follows variantOf");
    if (
      ts.isBindingElement(node) &&
      ["variantOf", "previousPaths"].includes(
        (node.propertyName ?? node.name).getText(source),
      )
    )
      report(node, "destructures a branch-point field");
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      CASE_FOLDS.has(node.expression.name.text) &&
      pathReceiver(node.expression.expression)
    )
      report(node, "case-folds a path");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

async function shellModules(): Promise<string[]> {
  const files: string[] = [];
  for (const root of ROOTS) {
    const entries = await fs.readdir(path.join(repositoryRoot, root), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      const file = path.relative(
        repositoryRoot,
        path.join(entry.parentPath, entry.name),
      );
      if (
        entry.isFile() &&
        /\.tsx?$/.test(entry.name) &&
        !file.split(path.sep).includes("_tests_") &&
        file !== LOOKUP
      )
        files.push(file);
    }
  }
  return files.sort();
}

function parse(fileName: string, text: string): ts.SourceFile {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
}

test("shell modules map branch-point identities only through the lookup", async () => {
  const violations: string[] = [];
  for (const file of await shellModules())
    violations.push(
      ...branchPointViolations(
        parse(file, await fs.readFile(path.join(repositoryRoot, file), "utf8")),
      ),
    );
  assert.deepEqual(violations, []);
});

test("the guard recognizes each prohibited mapping and its permitted forms", () => {
  const rules = (text: string) =>
    branchPointViolations(parse("probe.ts", text)).map((item) =>
      item.replace(/^probe\.ts:\d+ /, ""),
    );
  assert.deepEqual(rules("catalogue.previousPaths.get(entry.path);"), [
    "reads previousPaths",
  ]);
  assert.deepEqual(rules("const { previousPaths } = catalogue;"), [
    "destructures a branch-point field",
  ]);
  assert.deepEqual(rules("entry.variantOf === parent.path;"), [
    "compares or follows variantOf",
  ]);
  assert.deepEqual(rules("byPath.get(entry?.variantOf);"), [
    "compares or follows variantOf",
  ]);
  assert.deepEqual(rules('entry["variantOf"] === path;'), [
    "compares or follows variantOf",
  ]);
  assert.deepEqual(rules("const { variantOf } = entry;"), [
    "destructures a branch-point field",
  ]);
  assert.deepEqual(rules("item.path.toLowerCase() === other;"), [
    "case-folds a path",
  ]);
  assert.deepEqual(rules("baselinePath.toLowerCase();"), ["case-folds a path"]);
  assert.deepEqual(
    rules(
      [
        "entry.variantOf === undefined;",
        "entry.variantOf !== undefined ? { variantOf: entry.variantOf } : {};",
        "typeof entry.variantOf;",
        '"variantOf" in entry;',
        "tag.toLowerCase();",
        "query.freeText.toLowerCase();",
      ].join("\n"),
    ),
    [],
  );
});
