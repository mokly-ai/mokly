/** Resolve authored constant strings without evaluating code or reading ambient state. */

import ts from "typescript";

import { unwrapped } from "./deterministic-access";

export function constantValue(
  checker: ts.TypeChecker,
  input: ts.Node,
  seen = new Set<ts.Node>(),
): string | number | undefined {
  const node = unwrapped(input);
  if (seen.has(node)) return undefined;
  const next = new Set([...seen, node]);
  const value = (child: ts.Node) => constantValue(checker, child, next);
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isIdentifier(node)) {
    let symbol = checker.getSymbolAtLocation(node);
    if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias)
      symbol = checker.getAliasedSymbol(symbol);
    const declaration = symbol?.valueDeclaration;
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      ts.isVariableDeclarationList(declaration.parent) &&
      declaration.parent.flags & ts.NodeFlags.Const
    )
      return value(declaration.initializer);
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const constant = checker.getConstantValue(node);
    if (constant !== undefined) return constant;
    const type = checker.getTypeAtLocation(node);
    const symbol = checker.getSymbolAtLocation(
      ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression,
    );
    const declaration = symbol?.valueDeclaration;
    if (declaration && ts.isEnumMember(declaration))
      return (
        checker.getConstantValue(declaration) ??
        (declaration.initializer && value(declaration.initializer))
      );
    if (
      type.isStringLiteral() &&
      declaration &&
      ts.isPropertyAssignment(declaration)
    )
      return value(declaration.initializer);
  }
  if (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = value(node.left);
    const right = value(node.right);
    if (left === undefined || right === undefined) return undefined;
    return typeof left === "string" || typeof right === "string"
      ? String(left) + String(right)
      : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text;
    for (const span of node.templateSpans) {
      const part = value(span.expression);
      if (part === undefined) return undefined;
      result += String(part) + span.literal.text;
    }
    return result;
  }
  return undefined;
}
