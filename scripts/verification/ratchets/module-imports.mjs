import ts from "typescript";

import { stringSpecifier } from "./module-syntax.mjs";

/** Collect statically resolvable ES, CommonJS, and dynamic import use. */
export function collectModuleImports(source) {
  const bindings = new Map();
  const imports = [];
  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement))
      collectImportDeclaration(statement, bindings, imports);
    if (ts.isImportEqualsDeclaration(statement))
      collectImportEquals(statement, bindings, imports);
  }
  const visit = (node) => {
    if (ts.isVariableDeclaration(node)) collectVariableImport(node, imports);
    if (
      ts.isPropertyAccessExpression(node) ||
      ts.isElementAccessExpression(node)
    )
      collectPropertyImport(node, imports);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { bindings, imports };
}

function collectImportDeclaration(statement, bindings, imports) {
  const specifier = stringSpecifier(statement.moduleSpecifier);
  if (!specifier || !statement.importClause) return;
  const clause = statement.importClause;
  if (clause.name) {
    const item = { defaultImport: true, specifier };
    bindings.set(clause.name.text, item);
    imports.push(item);
  }
  const named = clause.namedBindings;
  if (named && ts.isNamespaceImport(named)) {
    const item = { namespace: true, specifier };
    bindings.set(named.name.text, item);
    imports.push(item);
  } else if (named) {
    const names = [];
    for (const element of named.elements) {
      const imported = (element.propertyName ?? element.name).text;
      names.push(imported);
      bindings.set(element.name.text, { imported, specifier });
    }
    imports.push({ names, specifier });
  }
}

function collectImportEquals(statement, bindings, imports) {
  if (!ts.isExternalModuleReference(statement.moduleReference)) return;
  const specifier = stringSpecifier(statement.moduleReference.expression);
  if (!specifier) return;
  const item = { namespace: true, specifier };
  bindings.set(statement.name.text, item);
  imports.push(item);
}

function collectVariableImport(declaration, imports) {
  const requirePath = requireSpecifier(declaration.initializer);
  const dynamicPath = dynamicImportSpecifier(declaration.initializer);
  const specifier = requirePath ?? dynamicPath;
  if (!specifier) return;
  if (ts.isObjectBindingPattern(declaration.name)) {
    imports.push({ names: bindingPropertyNames(declaration.name), specifier });
  } else if (ts.isIdentifier(declaration.name)) {
    imports.push({ namespace: true, specifier });
  }
}

function collectPropertyImport(expression, imports) {
  const specifier =
    requireSpecifier(expression.expression) ??
    dynamicImportSpecifier(expression.expression);
  if (!specifier) return;
  const name = ts.isPropertyAccessExpression(expression)
    ? expression.name.text
    : propertyName(expression.argumentExpression);
  if (name) imports.push({ names: [name], specifier });
}

function bindingPropertyNames(pattern) {
  return pattern.elements
    .filter(ts.isBindingElement)
    .map((element) => propertyName(element.propertyName ?? element.name))
    .filter(Boolean);
}

function requireSpecifier(expression) {
  const current = unwrapParentheses(expression);
  if (
    !current ||
    !ts.isCallExpression(current) ||
    !ts.isIdentifier(current.expression) ||
    current.expression.text !== "require" ||
    current.arguments.length !== 1
  )
    return undefined;
  return stringSpecifier(current.arguments[0]);
}

function dynamicImportSpecifier(expression) {
  const awaited = unwrapParentheses(expression);
  if (!awaited || !ts.isAwaitExpression(awaited)) return undefined;
  const current = unwrapParentheses(awaited.expression);
  if (
    !current ||
    !ts.isCallExpression(current) ||
    current.expression.kind !== ts.SyntaxKind.ImportKeyword
  )
    return undefined;
  return stringSpecifier(current.arguments[0]);
}

function unwrapParentheses(expression) {
  let current = expression;
  while (current && ts.isParenthesizedExpression(current))
    current = current.expression;
  return current;
}

function propertyName(name) {
  return name &&
    (ts.isIdentifier(name) ||
      ts.isStringLiteralLike(name) ||
      ts.isNumericLiteral(name))
    ? name.text
    : undefined;
}
