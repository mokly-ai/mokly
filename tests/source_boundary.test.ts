import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConsumerGraph } from "../dist/build/load_graph.js";
import { loadConfig } from "../dist/config/load.js";

import {
  createFixture,
  registerFixturePage,
  removeFixture,
} from "./helpers/fixture.js";

for (const consumer of [
  "config",
  "entry",
  "renderer",
  "transformer",
  "page",
  "template",
] as const) {
  test(`${consumer} imports reject authoring inputs outside repoRoot`, async (context) => {
    const fixture = await createFixture();
    const outside = await createFixture();
    context.after(() => removeFixture(fixture));
    context.after(() => removeFixture(outside));
    const helper = path.join(outside.root, "outside-helper.ts");
    await fs.promises.writeFile(
      helper,
      'export const title = "External"; export const source = () => "<!doctype html><html><body>External</body></html>";',
    );
    const imported = JSON.stringify(helper);
    if (consumer === "config") {
      await fs.promises.writeFile(
        fixture.configPath,
        `import { title } from ${imported}; export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: ".", review: { base: title } };`,
      );
    } else if (consumer === "entry") {
      await fs.promises.appendFile(
        fixture.entryPath,
        `\nimport { title } from ${imported}; mockups[0].title = title;`,
      );
    } else if (consumer === "page") {
      await registerFixturePage(fixture, "external", "external.html", helper);
    } else if (consumer === "template") {
      const template = path.join(outside.root, "outside-helper.html");
      await fs.promises.writeFile(
        template,
        "<!doctype html><html><body>External</body></html>",
      );
      const page = path.join(fixture.root, "page.ts");
      await fs.promises.writeFile(
        page,
        `import html from ${JSON.stringify(template)}; export const source = () => html;`,
      );
      await registerFixturePage(fixture, "external", "external.html", page);
      await fs.promises.writeFile(
        fixture.configPath,
        'export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: ".", moduleResolution: { loaders: { ".html": "text" } } };',
      );
    } else {
      const module = path.join(fixture.root, `${consumer}.ts`);
      await fs.promises.writeFile(
        module,
        `import { source } from ${imported}; export default source;`,
      );
      const setting =
        consumer === "renderer"
          ? 'renderer: "renderer.ts"'
          : 'compatibility: { transformer: "transformer.ts" }';
      await fs.promises.writeFile(
        fixture.configPath,
        `export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: ".", ${setting} };`,
      );
    }
    await assert.rejects(
      async () => {
        const config = await loadConfig(fixture.root);
        await loadConsumerGraph(config, { evaluate: false });
      },
      {
        code: "build-invalid",
        message:
          /authoring input must be a regular file inside repoRoot: .*outside-helper/,
      },
    );
  });
}

test("outside installed dependencies remain excluded from authoring inputs", async (context) => {
  const fixture = await createFixture();
  const outside = await createFixture();
  context.after(() => removeFixture(fixture));
  context.after(() => removeFixture(outside));
  const dependency = path.join(outside.root, "node_modules/helper/index.js");
  await fs.promises.mkdir(path.dirname(dependency), { recursive: true });
  await fs.promises.writeFile(dependency, 'export const title = "Dependency";');
  await fs.promises.appendFile(
    fixture.entryPath,
    `\nimport { title } from ${JSON.stringify(dependency)}; mockups[0].title = title;`,
  );
  const graph = await loadConsumerGraph(await loadConfig(fixture.root));
  assert.equal(
    (graph.definitions[0] as { definition: { title: string } }).definition
      .title,
    "Dependency",
  );
  assert.deepEqual(graph.sourceFiles, [
    "entries/fixture.mockup.tsx",
    "mokly.config.ts",
  ]);
});
