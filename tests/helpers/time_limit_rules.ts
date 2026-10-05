import path from "node:path";

import ts from "typescript";

import { testSourceLocation, visitTestSource } from "./test_sources.js";

/** Find setup and measured-duration limits that do not use the scale helper. */
export function unscaledTimeLimits(
  sources: readonly ts.SourceFile[],
): string[] {
  const files = new Map(sources.map((source) => [source.fileName, source]));
  const definitions = new Map<
    ts.Node,
    Map<string, ts.Expression | undefined>
  >();
  for (const source of sources) {
    visitTestSource(source, (node) => {
      if (
        (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        ts.isIdentifier(node.name)
      ) {
        const scope = lexicalScope(node);
        const names = definitions.get(scope) ?? new Map();
        names.set(
          node.name.text,
          ts.isParameter(node) ? undefined : node.initializer,
        );
        definitions.set(scope, names);
      }
    });
  }
  const localValue = (node: ts.Identifier) => {
    for (
      let scope: ts.Node | undefined = node.parent;
      scope;
      scope = scope.parent
    ) {
      const names = definitions.get(scope);
      if (names?.has(node.text))
        return { found: true, value: names.get(node.text) };
    }
    return { found: false, value: undefined };
  };
  const scaled = (node: ts.Expression, seen = new Set<ts.Node>()): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isParenthesizedExpression(node))
      return scaled(node.expression, seen);
    if (ts.isCallExpression(node) && callName(node) === "scaledTimeLimit")
      return true;
    if (!ts.isIdentifier(node)) return false;
    const source = node.getSourceFile();
    const local = localValue(node);
    if (local.found) return Boolean(local.value && scaled(local.value, seen));
    for (const statement of source.statements) {
      if (
        !ts.isImportDeclaration(statement) ||
        !ts.isStringLiteral(statement.moduleSpecifier)
      )
        continue;
      const bindings = statement.importClause?.namedBindings;
      if (!bindings || !ts.isNamedImports(bindings)) continue;
      const binding = bindings.elements.find(
        (entry) => entry.name.text === node.text,
      );
      if (!binding) continue;
      const target = path
        .resolve(path.dirname(source.fileName), statement.moduleSpecifier.text)
        .replace(/\.js$/u, ".ts");
      const imported = files.get(target);
      const value =
        imported &&
        definitions
          .get(imported)
          ?.get(binding.propertyName?.text ?? binding.name.text);
      if (value) return scaled(value, seen);
    }
    return false;
  };
  const measured = (
    node: ts.Expression,
    seen = new Set<ts.Node>(),
  ): boolean => {
    if (seen.has(node)) return false;
    seen.add(node);
    if (ts.isParenthesizedExpression(node))
      return measured(node.expression, seen);
    if (ts.isIdentifier(node)) {
      const { value } = localValue(node);
      return (
        /elapsed|duration|readiness|readyMs/iu.test(node.text) ||
        Boolean(value && measured(value, seen))
      );
    }
    if (ts.isPropertyAccessExpression(node))
      return /elapsed|duration/iu.test(node.name.text);
    return (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.MinusToken &&
      /(?:performance|Date)\.now\(|hrtime\(/u.test(node.getText())
    );
  };
  const failures: string[] = [];
  const check = (value: ts.Expression, kind: string): void => {
    if (!scaled(value))
      failures.push(
        `${testSourceLocation(value)}: ${kind} needs scaledTimeLimit`,
      );
  };
  for (const source of sources) {
    visitTestSource(source, (node) => {
      if (ts.isObjectLiteralExpression(node) && fixtureOptions(node)) {
        const timeout = property(node, "timeout");
        if (timeout) check(timeout, "fixture setup");
      }
      if (ts.isCallExpression(node)) {
        if (
          callName(node) === "setTimeout" &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.expression.getText() === "test" &&
          insideCall(node, "beforeAll")
        ) {
          if (node.arguments[0]) check(node.arguments[0], "beforeAll setup");
        }
        if (callName(node) === "before") {
          for (const argument of node.arguments) {
            if (!ts.isObjectLiteralExpression(argument)) continue;
            const timeout = property(argument, "timeout");
            if (timeout) check(timeout, "before setup");
          }
        }
        if (
          ["toBeLessThan", "toBeLessThanOrEqual"].includes(
            callName(node) ?? "",
          ) &&
          ts.isPropertyAccessExpression(node.expression)
        ) {
          const expectation = node.expression.expression;
          if (
            ts.isCallExpression(expectation) &&
            callName(expectation) === "expect" &&
            expectation.arguments[0] &&
            measured(expectation.arguments[0]) &&
            node.arguments[0]
          )
            check(node.arguments[0], "measured duration upper bound");
        }
      }
      if (!ts.isBinaryExpression(node) || !insideAssertion(node)) return;
      const operator = node.operatorToken.kind;
      const less = [
        ts.SyntaxKind.LessThanToken,
        ts.SyntaxKind.LessThanEqualsToken,
      ].includes(operator);
      const greater = [
        ts.SyntaxKind.GreaterThanToken,
        ts.SyntaxKind.GreaterThanEqualsToken,
      ].includes(operator);
      if (!less && !greater) return;
      const duration = less ? node.left : node.right;
      const bound = less ? node.right : node.left;
      if (measured(duration) && !measured(bound))
        check(bound, "measured duration upper bound");
    });
  }
  return failures;
}

function lexicalScope(node: ts.Node): ts.Node {
  for (let scope = node.parent; scope; scope = scope.parent) {
    if (
      ts.isSourceFile(scope) ||
      ts.isBlock(scope) ||
      ts.isForStatement(scope) ||
      ts.isForOfStatement(scope) ||
      ts.isForInStatement(scope) ||
      ts.isFunctionLike(scope)
    )
      return scope;
  }
  return node.getSourceFile();
}

function fixtureOptions(node: ts.ObjectLiteralExpression): boolean {
  const scope = property(node, "scope");
  if (scope && ts.isStringLiteralLike(scope) && scope.text === "worker")
    return true;
  const tuple = node.parent;
  if (
    !ts.isArrayLiteralExpression(tuple) ||
    tuple.elements.length !== 2 ||
    tuple.elements[1] !== node
  )
    return false;
  const prepare = tuple.elements[0]!;
  return (
    ts.isArrowFunction(prepare) ||
    ts.isFunctionExpression(prepare) ||
    ts.isIdentifier(prepare)
  );
}

function callName(node: ts.CallExpression): string | undefined {
  return ts.isIdentifier(node.expression)
    ? node.expression.text
    : ts.isPropertyAccessExpression(node.expression)
      ? node.expression.name.text
      : undefined;
}

function property(
  object: ts.ObjectLiteralExpression,
  name: string,
): ts.Expression | undefined {
  const entry = object.properties.find(
    (entry) =>
      (ts.isPropertyAssignment(entry) ||
        ts.isShorthandPropertyAssignment(entry)) &&
      entry.name.getText().replace(/["']/gu, "") === name,
  );
  if (entry && ts.isShorthandPropertyAssignment(entry)) return entry.name;
  return entry && ts.isPropertyAssignment(entry)
    ? entry.initializer
    : undefined;
}

function insideCall(node: ts.Node, name: string): boolean {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (ts.isCallExpression(parent) && callName(parent) === name) return true;
  return false;
}

function insideAssertion(node: ts.Node): boolean {
  for (let parent = node.parent; parent; parent = parent.parent)
    if (
      ts.isCallExpression(parent) &&
      /^(?:assert\.|expect\()/u.test(parent.getText())
    )
      return true;
  return false;
}
