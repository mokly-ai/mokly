import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import ts from "typescript";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../../dist/server/client_modules.js";

import { keep, move, retainedStandalone, retire } from "./shell_partition.mjs";

const hydrationBundles = new Set(["/__mokly/client/react-shell.js"]);
const viewerSource = path.resolve(
  import.meta.dirname,
  "../../packages/viewer/src",
);

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
  inspectPartitionInventory(modules);
  inspectSourcePartition();
  for (const [name, bytes] of modules) inspectModule(modules, name, bytes);
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
      /react-dom|hydrateRoot|react\.production|from\s*["']react(?:["'/])/,
      `Unexpected React runtime in ${name}`,
    );
  }
  for (const specifier of sourceImportSpecifiers(code, name)) {
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
    assertShellPartitionEdge(name, target);
  }
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

function inspectPartitionInventory(modules) {
  const sourceDirectory = path.join(viewerSource, "client");
  const sourceModules = fs
    .readdirSync(sourceDirectory)
    .filter((name) => name.endsWith(".ts"))
    .map((name) => name.slice(0, -3))
    .sort();
  const partition = [...keep, ...retire, ...move].sort();
  assert.deepEqual(
    partition,
    sourceModules,
    "Shell partition inventory drifted",
  );
  assert.equal(
    new Set(partition).size,
    partition.length,
    "Shell partition contains duplicate modules",
  );
  for (const module of sourceModules) {
    const output = module === "browse" ? "browse_runtime" : module;
    assert.ok(
      modules.has(`/__mokly/client/${output}.js`),
      `Missing browser output for ${module}`,
    );
  }
  assert.ok(
    modules.has("/__mokly/client/navigation-resize.js"),
    "Missing retained navigation-resize.js browser entry",
  );
}

function inspectSourcePartition() {
  inspectSourcePartitionAt(viewerSource);
}

/** Inspect source partition edges beneath an explicit viewer source root. */
export function inspectSourcePartitionAt(sourceDirectory) {
  for (const importer of [...keep, ...retire, ...move].map(
    (name) => `client/${name}`,
  ))
    inspectSourceModule(sourceDirectory, importer, false);
  for (const importer of retainedStandalone)
    inspectSourceModule(sourceDirectory, importer, true);
}

function inspectSourceModule(sourceDirectory, importer, retained) {
  const filename = sourceFilename(sourceDirectory, importer);
  const code = fs.readFileSync(filename, "utf8");
  for (const specifier of sourceImportSpecifiers(code, filename)) {
    if (!specifier.startsWith(".")) continue;
    const target = sourceModule(importer, specifier);
    if (importer.startsWith("client/") && target.startsWith("client/"))
      assertSourcePartitionEdge(importer, target);
    if (!retained) continue;
    const retainedTarget =
      retainedStandalone.includes(target) ||
      (target.startsWith("client/") &&
        keep.includes(path.posix.basename(target)));
    assert.ok(
      retainedTarget,
      `Retained standalone module imports retiring source: ${importer} -> ${target}`,
    );
  }
}

function sourceFilename(sourceDirectory, module) {
  for (const extension of [".ts", ".tsx"]) {
    const filename = path.join(sourceDirectory, `${module}${extension}`);
    if (fs.existsSync(filename)) return filename;
  }
  throw new Error(`Missing partition source module: ${module}`);
}

function sourceModule(importer, specifier) {
  return path.posix
    .normalize(path.posix.join(path.posix.dirname(importer), specifier))
    .replace(/\.(?:js|ts|tsx)$/, "");
}

function assertSourcePartitionEdge(importer, target) {
  const importerModule = path.posix.basename(importer);
  const targetModule = path.posix.basename(target);
  assert.ok(
    !keep.includes(importerModule) || !retire.includes(targetModule),
    `Kept shell source imports retired module: ${importerModule} -> ${targetModule}`,
  );
}

/** Fail a concrete delivered import edge that crosses keep into retire. */
export function assertShellPartitionEdge(importer, target) {
  if (
    !importer.startsWith("/__mokly/client/") ||
    !target.startsWith("/__mokly/client/")
  )
    return;
  const importerModule = path.posix.basename(importer, ".js");
  const targetModule = path.posix.basename(target, ".js");
  assert.ok(
    !keep.includes(importerModule) || !retire.includes(targetModule),
    `Kept shell module imports retired module: ${importerModule} -> ${targetModule}`,
  );
}
