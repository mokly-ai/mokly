/** Built-in imports can expose ambient state under names unrelated to its global. */

import { isBuiltin } from "node:module";

import ts from "typescript";

export function nodeImport(node: ts.Node): ts.StringLiteralLike | undefined {
  let specifier: ts.Node | undefined;
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
    specifier = node.moduleSpecifier;
  else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument))
    specifier = node.argument.literal;
  else if (
    ts.isImportEqualsDeclaration(node) &&
    ts.isExternalModuleReference(node.moduleReference)
  )
    specifier = node.moduleReference.expression;
  else if (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
      (ts.isIdentifier(node.expression) && node.expression.text === "require"))
  )
    specifier = node.arguments[0];
  return specifier &&
    ts.isStringLiteralLike(specifier) &&
    (specifier.text.startsWith("node:") || isBuiltin(specifier.text))
    ? specifier
    : undefined;
}
