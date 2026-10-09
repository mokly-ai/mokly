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
import { pageSource, pathFixture } from "./helpers/path_fixture.js";

for (const prefix of ["mokly-generated", "Mokly-Generated"]) {
  for (const declared of [false, true])
    test(`${declared ? "declared" : "derived"} paths reject the reserved ${prefix} tree at the export`, async (context) => {
      const file = declared
        ? "specs/page.mockup.ts"
        : `specs/${prefix}/styles.mockup.ts`;
      const entryPath = `${prefix}/styles`;
      const fixture = await pathFixture({
        [file]: pageSource(
          declared ? `path: ${JSON.stringify(entryPath)},` : "",
        ),
      });
      context.after(fixture.remove);
      await assert.rejects(fixture.compile(), {
        message: `[mokly/build-invalid] catalogue is invalid:\n- [invalid-path] ${file} export default: path ${JSON.stringify(entryPath)} is not a valid path`,
      });
    });

  test(`root prefixes reject the reserved ${prefix} tree`, async (context) => {
    const fixture = await pathFixture(
      { "specs/page.mockup.ts": pageSource() },
      `{mockupsDir: "generated", roots: [{ dir: "specs", path: "${prefix}/area" }]}`,
    );
    context.after(fixture.remove);
    await assert.rejects(fixture.compile(), {
      message: "[mokly/config-invalid] roots[0].path must be a valid path",
    });
  });
}

test("the generated folder name remains valid below an ordinary first segment", async (context) => {
  const fixture = await pathFixture({
    "specs/reports/mokly-generated/styles.mockup.ts": pageSource(),
  });
  context.after(fixture.remove);
  assert.equal(
    (await fixture.compile()).manifest.entries[0]?.path,
    "reports/mokly-generated/styles",
  );
});

test("v10 map keys are relative to the unified generated tree", async (context) => {
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
  assert.ok(routes.includes(viewRoute("home", "mobile", "light")));
  assert.ok(routes.includes(entryRoute("notice")));
  assert.ok(routes.every((route) => !route.startsWith("mokly-generated/")));
  assert.equal(
    config.generatedDir,
    path.join(config.mockupsDir, "mokly-generated"),
  );
  assert.doesNotThrow(() => validateGeneratedOutputPaths(routes, config));
});
