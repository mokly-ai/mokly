import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

for (const [kind, importSource] of [
  ["extensionless", (name: string) => `import ${JSON.stringify(name)};`],
  ["require", (name: string) => `require(${JSON.stringify(name)});`],
  ["dynamic", (name: string) => `void import(${JSON.stringify(name)});`],
] as const) {
  test(`${kind} package CSS outside repoRoot names its importing entry`, async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const packageName = `mokly-review-css-${path.basename(fixture.root)}`;
    const packageRoot = path.join(
      path.dirname(fixture.root),
      "node_modules",
      packageName,
    );
    await fs.mkdir(packageRoot, { recursive: true });
    context.after(() => fs.rm(packageRoot, { recursive: true, force: true }));
    await fs.writeFile(
      path.join(packageRoot, "package.json"),
      JSON.stringify({
        name: packageName,
        exports: { import: "./style.css", require: "./style.css" },
        main: "./style.css",
      }),
    );
    await fs.writeFile(
      path.join(packageRoot, "style.css"),
      ".external{color:red}",
    );
    await fs.appendFile(fixture.entryPath, `\n${importSource(packageName)}`);
    const config = await loadConfig(fixture.root);
    await assert.rejects(compileCatalogue(config), (error: Error) => {
      assert.equal(
        error.message,
        `[mokly/build-invalid] CSS import is outside repoRoot in entries/fixture.mockup.tsx: ${packageName}; move the stylesheet inside repoRoot or remove the import`,
      );
      assert.doesNotMatch(error.message, /mokly:styles:/);
      return true;
    });
  });
}
