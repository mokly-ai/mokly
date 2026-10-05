import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("config imports resolve consumer packages from the config location", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const packageDir = path.join(
    fixture.root,
    "node_modules",
    "@fixture",
    "mokly-paths",
  );
  await fs.promises.mkdir(packageDir, { recursive: true });
  await fs.promises.writeFile(
    path.join(packageDir, "package.json"),
    `${JSON.stringify({
      exports: "./index.js",
      name: "@fixture/mokly-paths",
      type: "module",
      version: "1.0.0",
    })}\n`,
  );
  await fs.promises.writeFile(
    path.join(packageDir, "index.js"),
    'export const paths = { roots: [{ dir: "entries" }], mockupsDir: "mockups" };\n',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    `import { defineConfig } from "@mokly/mokly";
import { paths } from "@fixture/mokly-paths";
export default defineConfig({ ...paths, repoRoot: "." });
`,
  );

  const config = await loadConfig(fixture.root);

  assert.equal(config.roots[0]?.dir, fixture.entriesDir);
  assert.equal(config.mockupsDir, fixture.mockupsDir);
});
