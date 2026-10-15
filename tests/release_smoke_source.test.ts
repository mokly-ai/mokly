import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { SMOKE_SOURCE } from "../scripts/release/smoke_source.mjs";

/** Every `import { names } from "specifier"` of one module source. */
function namedImports(source: string): Map<string, string[]> {
  const imports = new Map<string, string[]>();
  for (const [, names, specifier] of source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g,
  ))
    imports.set(
      specifier!,
      names!
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean),
    );
  return imports;
}

test("the release smoke names only exports the built viewer has", async () => {
  const imports = [...namedImports(SMOKE_SOURCE)].filter(([specifier]) =>
    specifier.startsWith("@mokly/viewer"),
  );
  assert.deepEqual(
    imports.map(([specifier]) => specifier),
    ["@mokly/viewer", "@mokly/viewer/data"],
  );
  for (const [specifier, names] of imports) {
    const module = (await import(specifier)) as Record<string, unknown>;
    for (const name of names)
      assert.ok(name in module, `${specifier} does not export ${name}`);
  }
});

test("the release smoke resolves every entry it reads as a file", () => {
  const resolved = [
    ...SMOKE_SOURCE.matchAll(/import\.meta\.resolve\("([^"]+)"\)/g),
  ].map((match) => match[1]!);
  assert.deepEqual(resolved, [
    "@mokly/viewer/browser",
    "@mokly/viewer/styles.css",
  ]);
  for (const specifier of resolved)
    assert.ok(
      fs.existsSync(new URL(import.meta.resolve(specifier))),
      specifier,
    );
});
