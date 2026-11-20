/** Date construction and conversion must not use the runner's calendar or string defaults. */

import ts from "typescript";

import { access, memberName, unwrapped } from "./deterministic-access";
import { constantValue } from "./deterministic-constant";
import { localDateMembers } from "./deterministic-date-policy";
import {
  isDateConstructor,
  isDateValue,
  signatureIdentity,
} from "./deterministic-types";
import type { Reject } from "./deterministic-types";

export function checkDateValue(
  node: ts.Node,
  checker: ts.TypeChecker,
  reject: Reject,
) {
  function checkMember(member: string, location: ts.Node) {
    if (localDateMembers.has(member))
      reject(location, "local-time Date member is forbidden: " + member);
    if (member === "toString")
      reject(location, "Date string conversion is forbidden");
  }
  if (
    ts.isPropertyAccessExpression(node) ||
    ts.isElementAccessExpression(node)
  ) {
    const member =
      memberName(node) ??
      (ts.isElementAccessExpression(node)
        ? constantValue(checker, node.argumentExpression)
        : undefined);
    if (typeof member === "string" && isDateValue(checker, node.expression))
      checkMember(member, node);
  }
  if (
    ts.isBindingElement(node) &&
    ts.isObjectBindingPattern(node.parent) &&
    isDateValue(checker, node.parent)
  ) {
    const property = node.propertyName ?? node.name;
    if (ts.isIdentifier(property) || ts.isStringLiteralLike(property))
      checkMember(property.text, node);
  }
  if (ts.isTemplateExpression(node))
    for (const span of node.templateSpans)
      if (isDateValue(checker, span.expression))
        reject(span.expression, "Date template interpolation is forbidden");
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.PlusToken, ts.SyntaxKind.PlusEqualsToken].includes(
      node.operatorToken.kind,
    ) &&
    (isDateValue(checker, node.left) || isDateValue(checker, node.right))
  )
    reject(node, "Date string concatenation is forbidden");
  if (!(ts.isCallExpression(node) || ts.isNewExpression(node))) return;
  const called = access(node.expression);
  const signature = signatureIdentity(checker, node);
  const args = node.arguments ?? [];
  if (
    (called === "String" ||
      (signature.constructorName === "String" && !signature.method)) &&
    args[0] &&
    isDateValue(checker, args[0])
  )
    reject(node, "Date string conversion is forbidden");
  const constructingDate =
    ts.isNewExpression(node) &&
    (isDateValue(checker, node) || isDateConstructor(checker, node.expression));
  const parsingDate =
    called === "Date.parse" ||
    (signature.constructorName === "Date" && signature.method === "parse");
  if (constructingDate && args.length >= 2)
    reject(node, "Date construction requires one explicit value");
  if (!(parsingDate || (constructingDate && args.length === 1)) || !args[0])
    return;
  const type = checker.getTypeAtLocation(unwrapped(args[0]));
  if (
    constructingDate &&
    (type.flags & ts.TypeFlags.NumberLike || isDateValue(checker, args[0]))
  )
    return;
  const value = constantValue(checker, args[0]);
  if (typeof value !== "string") {
    reject(args[0], "Date string input must be a compile-time constant");
    return;
  }
  if (
    /\d{1,2}:\d{2}|[Tt]\d{2}|\d\s*(?:am|pm)\b/i.test(value) &&
    !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value.trim())
  )
    reject(args[0], "Date time input requires Z or an explicit UTC offset");
}
