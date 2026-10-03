import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateGeneratedOutputPaths } from "../dist/build/output_paths.js";
import { loadConfig } from "../dist/config/load.js";
import { entryRoute, viewRoute } from "../packages/viewer/dist/data.js";

import {
  createFixture,
  registerFixturePage,
  removeFixture,
} from "./helpers/fixture.js";

test("v8 map keys are relative to the unified generated tree", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "document.source.ts"),
    'export const source = () => "<!doctype html><html><body>Page</body></html>";',
  );
  await registerFixturePage(fixture, "notice", "ignored", "document.source.ts");
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  const routes = [...compilation.outputs.keys()].filter((route) =>
    route.endsWith(".html"),
  );
  assert.ok(routes.includes(viewRoute("screen", "home", "mobile", "light")));
  assert.ok(routes.includes(entryRoute("page", "notice")));
  assert.ok(routes.every((route) => !route.startsWith("mokly-generated/")));
  assert.equal(
    config.generatedDir,
    path.join(config.mockupsDir, "mokly-generated"),
  );
  assert.doesNotThrow(() => validateGeneratedOutputPaths(routes, config));
});
