/** Resolve direct global access and distinguish value references from property names. */

import ts from "typescript";

const prefixes = new Set(["globalThis", "window", "self"]);

/** Type wrappers preserve the value that the source actually reads. */
function isWrapper(
  node: ts.Node,
): node is
  | ts.ParenthesizedExpression
  | ts.AsExpression
  | ts.SatisfiesExpression
  | ts.NonNullExpression
  | ts.TypeAssertion {
  return (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isNonNullExpression(node) ||
    ts.isTypeAssertionExpression(node)
  );
}

/** Remove wrappers before checking literal member names and formatting options. */
export function unwrapped(node: ts.Node): ts.Node {
  while (isWrapper(node)) node = node.expression;
  return node;
}

/** Resolve literal access with browser-global prefixes removed. */
export function access(node: ts.Node): string | undefined {
  let parts: string[] | undefined;
  if (ts.isIdentifier(node)) parts = [node.text];
  else if (
    ts.isMetaProperty(node) &&
    node.keywordToken === ts.SyntaxKind.ImportKeyword
  )
    return "import.meta";
  else if (isWrapper(node)) return access(node.expression);
  else if (ts.isPropertyAccessExpression(node)) {
    const base = access(node.expression);
    if (base !== undefined)
      parts = [...(base ? base.split(".") : []), node.name.text];
  } else if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression)
  ) {
    const base = access(node.expression);
    if (base !== undefined)
      parts = [...(base ? base.split(".") : []), node.argumentExpression.text];
  }
  if (!parts) return undefined;
  while (parts.length > 1 && prefixes.has(parts[0])) parts.shift();
  return parts.join(".");
}

/** Object keys, declaration names and Date type annotations do not read runtime globals. */
export function isReference(node: ts.Node): boolean {
  if (!ts.isIdentifier(node))
    return (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node) ||
      ts.isMetaProperty(node)
    );
  const parent = node.parent;
  if (
    (ts.isPropertyAccessExpression(parent) && parent.name === node) ||
    ts.isQualifiedName(parent) ||
    ts.isTypeReferenceNode(parent)
  )
    return false;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  if (
    "name" in parent &&
    parent.name === node &&
    !ts.isShorthandPropertyAssignment(parent)
  )
    return false;
  return true;
}

/** A namespace may supply a direct static member; Date may construct an explicit date. */
export function directNamespaceUse(node: ts.Node, name: string): boolean {
  let expression = node;
  while (isWrapper(expression.parent)) expression = expression.parent;
  const parent = expression.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.expression === expression)
    return true;
  if (
    ts.isElementAccessExpression(parent) &&
    parent.expression === expression &&
    ts.isStringLiteralLike(parent.argumentExpression)
  )
    return true;
  return (
    name === "Date" &&
    (ts.isNewExpression(parent) || ts.isCallExpression(parent)) &&
    parent.expression === expression
  );
}

/** A static method name, including literal bracket access. */
export function memberName(node: ts.Node): string | undefined {
  node = unwrapped(node);
  if (ts.isPropertyAccessExpression(node)) return node.name.text;
  if (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression)
  )
    return node.argumentExpression.text;
  return undefined;
}
