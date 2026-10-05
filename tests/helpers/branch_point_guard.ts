import fs from "node:fs/promises";
import path from "node:path";

import ts from "typescript";

import { repositoryRoot } from "./fixture.js";

const PATH_NAME = /^(path|entryId|parentId|componentId)$|Path$/;
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
export function branchPointViolations(source: ts.SourceFile): string[] {
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
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind)
    ) {
      const usageName = (value: ts.Expression) =>
        (ts.isIdentifier(value) ? value.text : readName(value)) ===
        "componentId";
      const pathOperand = (value: ts.Expression): boolean => {
        if (ts.isParenthesizedExpression(value))
          return pathOperand(value.expression);
        if (
          ts.isBinaryExpression(value) &&
          value.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
        )
          return pathOperand(value.left) || pathOperand(value.right);
        return pathReceiver(value);
      };
      if (
        (usageName(node.left) && pathOperand(node.right)) ||
        (usageName(node.right) && pathOperand(node.left))
      )
        report(node, "matches a usage component name outside the lookup");
    }
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["get", "has"].includes(node.expression.name.text) &&
      node.arguments.some(
        (argument) =>
          (ts.isIdentifier(argument) ? argument.text : readName(argument)) ===
          "componentId",
      )
    )
      report(node, "indexes a usage component name outside the lookup");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}

const ROOTS = [
  "packages/viewer/src/shell",
  "packages/viewer/src/viewer",
  "packages/viewer/src/catalogue",
  "src/catalogue",
];
const READER_VALIDATION = new Set([
  "reader.ts",
  "entry_reader.ts",
  "references.ts",
  "reference_views.ts",
  "tree_validation.ts",
]);

/** Normalize both separators before selecting the same files on every platform. */
export function guardedBranchPointModule(file: string): boolean {
  const normalized = file.split("\\").join("/");
  return (
    /\.tsx?$/.test(normalized) &&
    !normalized.split("/").includes("_tests_") &&
    normalized !== "packages/viewer/src/catalogue/branch_point.ts" &&
    !(
      normalized.startsWith("packages/viewer/src/catalogue/") &&
      READER_VALIDATION.has(normalized.split("/").at(-1)!)
    ) &&
    (normalized === "src/registry/entry_order.ts" ||
      ROOTS.some((root) => normalized.startsWith(`${root}/`)))
  );
}

/** Catalogue consumers and the projection's registry ordering helper. */
export async function branchPointModules(): Promise<string[]> {
  const files = ["src/registry/entry_order.ts"];
  for (const root of ROOTS) {
    const entries = await fs.readdir(path.join(repositoryRoot, root), {
      recursive: true,
      withFileTypes: true,
    });
    for (const entry of entries) {
      const file = path
        .relative(repositoryRoot, path.join(entry.parentPath, entry.name))
        .split("\\")
        .join("/");
      if (entry.isFile() && guardedBranchPointModule(file)) files.push(file);
    }
  }
  return files.sort();
}
