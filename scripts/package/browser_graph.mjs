import assert from "node:assert/strict";
import path from "node:path";

import ts from "typescript";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../../dist/server/client_modules.js";

const hydrationBundles = new Set(["/__mokly/client/react-shell.js"]);

/** Check the exact delivered inventory, not unused build-directory files. */
export function inspectBrowserGraph() {
  const modules = new Map([
    ...[...loadBrowserClientModules()].map(([name, bytes]) => [
      `/__mokly/client/${name}`,
      bytes,
    ]),
    ...[...loadBrowserNavigationModules()].map(([name, bytes]) => [
      `/__mokly/navigation/${name}`,
      bytes,
    ]),
  ]);
  return inspectDeliveredBrowserGraph(modules);
}

/** Check every import in an explicit delivered browser module graph. */
export function inspectDeliveredBrowserGraph(modules) {
  let importCount = 0;
  for (const [name, bytes] of modules)
    importCount += inspectModule(modules, name, bytes);
  assert.ok(importCount > 0, "No delivered browser import was inspected");
  for (const bundle of hydrationBundles)
    assert.ok(modules.has(bundle), `Missing hydration bundle: ${bundle}`);
  return modules.size;
}

function inspectModule(modules, name, bytes) {
  const code = bytes.toString("utf8");
  assert.doesNotMatch(code, /["']node:/, `Node runtime in ${name}`);
  if (hydrationBundles.has(name)) {
    assert.match(code, /hydrateRoot/, `Missing hydration runtime in ${name}`);
  } else {
    assert.doesNotMatch(
      code,
      /react-dom|hydrateRoot|react\.production|from\s*["'](?:react(?:["'/])|@mokly\/mokly)|(?:^|\/)dist\/cli\//,
      `Unexpected React runtime in ${name}`,
    );
  }
  const specifiers = sourceImportSpecifiers(code, name);
  for (const specifier of specifiers) {
    assert.ok(
      specifier.startsWith("."),
      `Bare import in ${name}: ${specifier}`,
    );
    const target = path.posix.normalize(
      path.posix.join(path.posix.dirname(name), specifier),
    );
    assert.ok(
      modules.has(target),
      `Missing delivered module: ${name} -> ${specifier}`,
    );
  }
  return specifiers.length;
}

/** Read every static, type, side-effect, re-export, and dynamic import. */
export function sourceImportSpecifiers(code, filename = "source.ts") {
  const source = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const specifiers = [];
  const visit = (node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      specifiers.push(node.moduleSpecifier.text);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    )
      specifiers.push(node.arguments[0].text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      specifiers.push(node.argument.literal.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return specifiers;
}
