import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../packages/mokly/dist/build/compile.js";
import { assertFreshSourceInventory } from "../packages/mokly/dist/build/source_freshness.js";
import { writeCompilation } from "../packages/mokly/dist/build/transaction.js";
import { loadConfig } from "../packages/mokly/dist/config/load.js";
import { isPublicStaticFile } from "../packages/mokly/dist/config/public_files.js";
import { FileSystemReviewAssetReader } from "../packages/mokly/dist/review/assets.js";
import { startCatalogueServer } from "../packages/mokly/dist/server/http.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";

test("both graphs retain raw and tree-shaken inputs while public resources stay public", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const files: Record<string, string> = {
    "settings.ts":
      'export const settings = { moduleResolution: { loaders: { ".html": "text", ".svg": "dataurl" } } };',
    "render.ts":
      'import raw from "./template.html"; import data from "./data.json"; import image from "./image.svg"; export const title = data.title + raw.length + image.length;',
    "unused.ts": 'export const unused = "private";',
    "data.json": '{"title":"Handbook"}',
    "template.html": "<html><body>Private template</body></html>",
    "image.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "public.svg": '<svg xmlns="http://www.w3.org/2000/svg"/>',
    "public.css": "body { color: blue; }",
    "unused.SOURCE.TSX":
      'throw new Error("unregistered source must never execute");',
  };
  for (const [file, content] of Object.entries(files))
    await fs.promises.writeFile(path.join(fixture.mockupsDir, file), content);
  await fs.promises.symlink(
    "render.ts",
    path.join(fixture.mockupsDir, "alias.ts"),
  );
  await fs.promises.symlink(
    "unused.SOURCE.TSX",
    path.join(fixture.mockupsDir, "disguised.txt"),
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { title } from "../mockups/alias.ts"; export { unused } from "../mockups/unused.ts"; mockups[0].title = title;',
  );
  await fs.promises.writeFile(
    fixture.configPath,
    'import { settings } from "./mockups/settings.ts"; export default { ...settings, roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: "." };',
  );
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  for (const source of [
    "settings.ts",
    "render.ts",
    "alias.ts",
    "unused.ts",
    "data.json",
    "template.html",
    "image.svg",
  ])
    assert.ok(
      compilation.manifest.sourceFiles.includes(`mockups/${source}`),
      source,
    );
  assert.equal(
    compilation.manifest.sourceFiles.includes("mockups/image.svg"),
    true,
  );
  await writeCompilation(compilation, config);
  const server = await startCatalogueServer(config, { base: "main", port: 0 });
  fixture.beforeRemove(() => server.close());
  const reader = new FileSystemReviewAssetReader(config);
  for (const route of [
    ...Object.keys(files).filter(
      (file) => !["public.svg", "public.css"].includes(file),
    ),
    "alias.ts",
    "disguised.txt",
  ]) {
    assert.equal(
      isPublicStaticFile(path.join(fixture.mockupsDir, route), config),
      false,
      route,
    );
    for (const method of ["GET", "HEAD"])
      assert.equal(
        (await fetch(`${server.url}/static/${route}`, { method })).status,
        404,
        `${method} ${route}`,
      );
    await assert.rejects(reader.read(route), /not a public static file/, route);
  }
  for (const route of ["public.svg", "public.css", "home/index.desktop.html"])
    assert.equal(
      (await fetch(`${server.url}/static/${route}`)).status,
      200,
      route,
    );
});

test("freshness resolves new imports without executing or rendering the graph", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const compilation = await compileCatalogue(config);
  await writeCompilation(compilation, config);
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nthrow new Error("must not execute freshness graph");',
  );
  await assertFreshSourceInventory(config, compilation.manifest);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "new.ts"),
    'export const name = "New";',
  );
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { name } from "../mockups/new.ts"; mockups[0].title = name;',
  );
  await assert.rejects(
    startCatalogueServer(config, { base: "main", port: 0 }),
    /source inventory is stale/,
  );
  assert.equal(
    await fs.promises.readFile(
      path.join(fixture.mockupsDir, "mokly-manifest.json"),
      "utf8",
    ),
    textOutput(compilation.outputs, "mokly-manifest.json"),
  );
});

test("failed page builds and source collisions preserve the previous inventory and bytes", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const good = await compileCatalogue(config);
  await writeCompilation(good, config);
  const inventory = config.sourceFiles;
  const source = path.join(fixture.mockupsDir, "document/index.html");
  const bytes = "<html><body>Protected source</body></html>";
  await fs.promises.mkdir(path.dirname(source), { recursive: true });
  await fs.promises.writeFile(source, bytes);
  await fs.promises.writeFile(
    fixture.configPath,
    'export default { roots: [{ dir: "entries" }], mockupsDir: "mockups", repoRoot: ".", moduleResolution: { loaders: { ".html": "text" } } };',
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    'import { definePage } from "@mokly/mokly"; import html from "../mockups/document/index.html"; export const mockups = [definePage({ path: "document", title: "Page", description: "Page", dependencies: [], relatedDocs: [], render: () => html })];',
  );
  const next = await loadConfig(fixture.root);
  await assert.rejects(compileCatalogue(next), /authoring|source/);
  assert.equal(config.sourceFiles, inventory);
  assert.equal(await fs.promises.readFile(source, "utf8"), bytes);
});
