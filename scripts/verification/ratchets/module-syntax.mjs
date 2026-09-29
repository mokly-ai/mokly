import ts from "typescript";

/** Read a literal module specifier without accepting computed paths. */
export function stringSpecifier(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : undefined;
}

/** Test a TypeScript modifier without depending on node-specific fields. */
export function hasModifier(node, kind) {
  return (
    ts.canHaveModifiers(node) &&
    ts.getModifiers(node)?.some((item) => item.kind === kind)
  );
}

/** Select the parser grammar associated with one workspace module. */
export function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/u.test(file)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Resolve a literal `await import()` expression when its path is static. */
function dynamicImportSpecifier(expression) {
  let current = expression;
  while (
    current &&
    (ts.isAwaitExpression(current) || ts.isParenthesizedExpression(current))
  )
    current = current.expression;
  if (
    current &&
    ts.isCallExpression(current) &&
    current.expression.kind === ts.SyntaxKind.ImportKeyword
  )
    return stringSpecifier(current.arguments[0]);
  return undefined;
}

/** Collect named destructuring from literal dynamic imports. */
export function dynamicImportRecords(source) {
  const imports = [];
  const visit = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name)
    ) {
      const specifier = dynamicImportSpecifier(node.initializer);
      if (specifier) {
        const names = node.name.elements
          .filter(ts.isBindingElement)
          .map((element) =>
            ts.isIdentifier(element.propertyName ?? element.name)
              ? (element.propertyName ?? element.name).text
              : undefined,
          )
          .filter(Boolean);
        imports.push({ specifier, names });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return imports;
}
