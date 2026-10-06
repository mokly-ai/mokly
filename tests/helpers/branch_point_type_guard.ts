import ts from "typescript";

import {
  boundReceiver,
  displayExpression,
  reactDependency,
  serializedRecord,
} from "./branch_point_type_context.js";
import { erasesReference, pathSides } from "./branch_point_type_values.js";

const CURRENT = 1;
const BEFORE = 2;
const COMPARISONS = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.LessThanToken,
  ts.SyntaxKind.LessThanEqualsToken,
  ts.SyntaxKind.GreaterThanToken,
  ts.SyntaxKind.GreaterThanEqualsToken,
]);

/** Reject typed references used as current identities or erased into text. */
export function typedBranchPointViolations(
  source: ts.SourceFile,
  checker: ts.TypeChecker,
): string[] {
  const violations: string[] = [];
  const report = (node: ts.Node, rule: string) => {
    const { line } = source.getLineAndCharacterOfPosition(node.getStart());
    violations.push(`${source.fileName}:${line + 1} ${rule}`);
  };
  const sides = (node: ts.Node) =>
    pathSides(checker, checker.getTypeAtLocation(node));
  const origin = (node: ts.Node, seen = new Set<ts.Node>()): number => {
    const type = checker.getTypeAtLocation(node);
    const element =
      (checker.isArrayType(type) || checker.isTupleType(type)) &&
      checker.getIndexTypeOfType(type, ts.IndexKind.Number);
    const known = sides(node) || (element ? pathSides(checker, element) : 0);
    if (known || seen.has(node)) return known;
    seen.add(node);
    if (
      ts.isParenthesizedExpression(node) ||
      ts.isAsExpression(node) ||
      ts.isTypeAssertionExpression(node)
    )
      return origin(node.expression, seen);
    if (ts.isIdentifier(node)) {
      const declaration = checker.getSymbolAtLocation(node)?.valueDeclaration;
      if (
        declaration &&
        ts.isVariableDeclaration(declaration) &&
        declaration.initializer
      )
        return origin(declaration.initializer, seen);
    }
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      checker.getTypeAtLocation(node).getCallSignatures().length
    )
      return origin(node.expression, seen);
    if (ts.isCallExpression(node)) {
      if (
        checker.getTypeAtLocation(node.expression).symbol?.name ===
        "StringConstructor"
      )
        return node.arguments.reduce(
          (bits, argument) => bits | origin(argument, seen),
          0,
        );
      if (
        (ts.isPropertyAccessExpression(node.expression) ||
          ts.isElementAccessExpression(node.expression)) &&
        checker.getTypeAtLocation(node).flags & ts.TypeFlags.StringLike
      )
        return origin(node.expression, seen);
    }
    if (ts.isTemplateExpression(node))
      return node.templateSpans.reduce(
        (bits, span) => bits | origin(span.expression, seen),
        0,
      );
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.PlusToken,
        ts.SyntaxKind.QuestionQuestionToken,
        ts.SyntaxKind.BarBarToken,
      ].includes(node.operatorToken.kind)
    )
      return origin(node.left, seen) | origin(node.right, seen);
    return 0;
  };
  const assignment = (
    node: ts.Node,
    value: ts.Expression,
    target: ts.Type | undefined,
  ) => {
    if (
      target &&
      !reactDependency(value, checker) &&
      !boundReceiver(value, checker) &&
      !serializedRecord(value, checker) &&
      erasesReference(checker, checker.getTypeAtLocation(value), target)
    )
      report(node, "erases a branch-point reference");
  };
  const visit = (node: ts.Node): void => {
    if (
      (ts.isPropertyAccessExpression(node) ||
        ts.isElementAccessExpression(node)) &&
      checker
        .getTypeAtLocation(node)
        .getCallSignatures()
        .some(
          (signature) =>
            Boolean(sides(node.expression) & BEFORE) ||
            Boolean(
              checker.getReturnTypeOfSignature(signature).flags &
                ts.TypeFlags.StringLike &&
              erasesReference(
                checker,
                checker.getTypeAtLocation(node.expression),
                checker.getReturnTypeOfSignature(signature),
              ),
            ),
        )
    )
      report(node, "uses a string method on a branch-point reference");
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression &&
      sides(node.argumentExpression) & BEFORE
    ) {
      const indexes = checker.getIndexInfosOfType(
        checker.getTypeAtLocation(node.expression),
      );
      if (!indexes.some((index) => pathSides(checker, index.keyType) & BEFORE))
        report(node, "uses a branch-point reference as an untyped key");
    }
    if (
      ts.isBinaryExpression(node) &&
      COMPARISONS.has(node.operatorToken.kind)
    ) {
      const left = sides(node.left),
        right = sides(node.right);
      if (
        (left & BEFORE && right & CURRENT) ||
        (right & BEFORE && left & CURRENT)
      )
        report(node, "compares reference sides outside the lookup");
      else if (
        (left & BEFORE &&
          checker.getTypeAtLocation(node.right).flags &
            ts.TypeFlags.StringLike &&
          !(right & BEFORE)) ||
        (right & BEFORE &&
          checker.getTypeAtLocation(node.left).flags &
            ts.TypeFlags.StringLike &&
          !(left & BEFORE))
      )
        report(node, "compares branch-point text outside the lookup");
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node))
      assignment(node, node.expression, checker.getTypeAtLocation(node));
    if (
      (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) &&
      sides(node.expression) & CURRENT &&
      !(sides(node) & CURRENT)
    )
      report(node, "erases or changes a current path");
    if (ts.isVariableDeclaration(node) && node.initializer && node.type)
      assignment(node, node.initializer, checker.getTypeAtLocation(node.name));
    if (ts.isPropertyAssignment(node))
      assignment(
        node,
        node.initializer,
        checker.getContextualType(node.initializer),
      );
    if (ts.isArrayLiteralExpression(node))
      for (const element of node.elements)
        if (!ts.isSpreadElement(element))
          assignment(element, element, checker.getContextualType(element));
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken
    )
      assignment(node, node.right, checker.getTypeAtLocation(node.left));
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const signature = checker.getResolvedSignature(node);
      const resultSide =
        signature &&
        pathSides(checker, checker.getReturnTypeOfSignature(signature));
      for (const [index, argument] of (node.arguments ?? []).entries()) {
        const parameter = signature?.parameters[index];
        const parameterType =
          parameter && checker.getTypeOfSymbolAtLocation(parameter, node);
        if (
          resultSide &&
          origin(argument) &&
          origin(argument) & ~resultSide &&
          (!parameterType || !pathSides(checker, parameterType))
        )
          report(argument, "converts between reference sides through text");
        if (parameter && !(resultSide && origin(argument) === resultSide))
          assignment(argument, argument, parameterType);
      }
    }
    if (ts.isReturnStatement(node) && node.expression) {
      let owner: ts.Node | undefined = node.parent;
      while (owner && !ts.isFunctionLike(owner)) owner = owner.parent;
      if (owner && ts.isFunctionLike(owner) && owner.type) {
        const signature = checker.getSignatureFromDeclaration(owner);
        if (signature)
          assignment(
            node,
            node.expression,
            checker.getReturnTypeOfSignature(signature),
          );
      }
    }
    if (
      ts.isTemplateExpression(node) &&
      !displayExpression(node) &&
      node.templateSpans.some((span) => sides(span.expression) & BEFORE)
    )
      report(node, "turns a branch-point reference into template text");
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      (sides(node.left) & BEFORE || sides(node.right) & BEFORE) &&
      !displayExpression(node)
    )
      report(node, "turns a branch-point reference into concatenated text");
    ts.forEachChild(node, visit);
  };
  visit(source);
  return violations;
}
