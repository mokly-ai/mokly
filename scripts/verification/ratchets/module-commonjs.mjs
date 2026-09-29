import ts from "typescript";

/** Add statically declared CommonJS named exports to one module record. */
export function addCommonJsExportNames(source, names) {
  for (const statement of source.statements) {
    if (!ts.isExpressionStatement(statement)) continue;
    const expression = statement.expression;
    if (
      !ts.isBinaryExpression(expression) ||
      expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken
    )
      continue;
    const name = assignedExportName(expression.left);
    if (name) {
      names.add(name);
      continue;
    }
    if (!isModuleExports(expression.left)) continue;
    const value = expression.right;
    if (!ts.isObjectLiteralExpression(value)) continue;
    for (const property of value.properties) {
      if (ts.isSpreadAssignment(property)) continue;
      const propertyName = exportName(property.name);
      if (propertyName) names.add(propertyName);
    }
  }
}

function assignedExportName(expression) {
  if (ts.isPropertyAccessExpression(expression)) {
    if (
      (ts.isIdentifier(expression.expression) &&
        expression.expression.text === "exports") ||
      isModuleExports(expression.expression)
    )
      return expression.name.text;
    return undefined;
  }
  if (!ts.isElementAccessExpression(expression)) return undefined;
  if (!(
    (ts.isIdentifier(expression.expression) &&
      expression.expression.text === "exports") ||
    isModuleExports(expression.expression)
  ))
    return undefined;
  return exportName(expression.argumentExpression);
}

function isModuleExports(expression) {
  if (ts.isPropertyAccessExpression(expression))
    return (
      ts.isIdentifier(expression.expression) &&
      expression.expression.text === "module" &&
      expression.name.text === "exports"
    );
  return (
    ts.isElementAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === "module" &&
    exportName(expression.argumentExpression) === "exports"
  );
}

function exportName(name) {
  return name &&
    (ts.isIdentifier(name) ||
      ts.isStringLiteralLike(name) ||
      ts.isNumericLiteral(name))
    ? name.text
    : undefined;
}
