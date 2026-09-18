import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../../dist/server/client_modules.js";

import { keep, move, retire } from "./shell_partition.mjs";

const hydrationBundles = new Set(["/__mokly/client/react-shell.js"]);
const importPattern = /\b(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g;

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
  for (const match of code.matchAll(importPattern)) {
    const specifier = match[1];
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

function inspectPartitionInventory(modules) {
  const sourceDirectory = path.resolve(
    import.meta.dirname,
    "../../packages/viewer/src/client",
  );
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
    const output =
      module === "browse"
        ? "browse_runtime"
        : module === "nav_resize"
          ? "navigation-resize"
          : module;
    assert.ok(
      modules.has(`/__mokly/client/${output}.js`),
      `Missing browser output for ${module}`,
    );
  }
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
