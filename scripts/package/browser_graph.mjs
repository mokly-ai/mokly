import assert from "node:assert/strict";
import path from "node:path";

import {
  loadBrowserClientModules,
  loadBrowserNavigationModules,
} from "../../dist/server/client_modules.js";

/** Check the exact delivered inventory, not unused files left in a build directory. */
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
  for (const [name, bytes] of modules) {
    const code = bytes.toString("utf8");
    assert.doesNotMatch(
      code,
      /react-dom|hydrateRoot|react\.production|from\s*["'](?:react|node:)/,
      `Unexpected runtime in ${name}`,
    );
    for (const match of code.matchAll(
      /\b(?:from\s*|import\s*\(\s*)["']([^"']+)["']/g,
    )) {
      assert.ok(
        match[1].startsWith("."),
        `Bare import in ${name}: ${match[1]}`,
      );
      const target = path.posix.normalize(
        path.posix.join(path.posix.dirname(name), match[1]),
      );
      assert.ok(
        modules.has(target),
        `Missing delivered module: ${name} -> ${match[1]}`,
      );
    }
  }
  return modules.size;
}
