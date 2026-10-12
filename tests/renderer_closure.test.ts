import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { generatedViews } from "@mokly/viewer/data";

import { compileCatalogue } from "../dist/build/compile.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { discoverWatchResources } from "../dist/server/watch_resources.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("renderer-only resources share full and requested closure validation", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const resource = path.join(fixture.mockupsDir, "widget.css");
  await fs.writeFile(resource, "button { color: blue; }");
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => ({html: '<html><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: [{ path: "widget.css", componentIds: ["action"] }] });`,
  );
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const views = compiled.manifest.entries.flatMap(generatedViews);
  assert.ok(views.length > 0);
  for (const view of views) {
    assert.ok(view.usage);
    assert.deepEqual(view.usage.resources, []);
    assert.deepEqual(view.usage.insertedStylesheets, []);
  }
  assert.deepEqual(
    compiled.diagnostics.map(({ code, route, message }) => ({
      code,
      route,
      message,
    })),
    views
      .map((view) => view.path)
      .sort()
      .map((route) => ({
        code: "ignored-stylesheet-resource-owner",
        route,
        message:
          'Stylesheet ownership for "widget.css" is ignored. Changes follow the elements that each changed rule matches.',
      })),
  );
  const observed = await discoverWatchResources(config, compiled);
  assert.deepEqual([...observed.closure], ["widget.css"]);
  assert.deepEqual([...observed.closure], compiled.manifest.assetClosure);
  const runtime = await prepareLiveRuntime(config);
  const server = await startCatalogueServer(config, {
    port: 0,
    base: "main",
    manifest: runtime.manifest,
    componentRuntime: runtime,
  });
  fixture.beforeRemove(() => server.close());
  assert.equal(
    (await fetch(server.url + "/static/mokly-generated/home/index.mobile.html"))
      .status,
    200,
  );
  assert.equal((await fetch(server.url + "/static/widget.css")).status, 200);
  await fs.rm(resource);
  await fs.writeFile(
    path.join(fixture.mockupsDir, "private.css"),
    "private {}",
  );
  await fs.symlink("private.css", resource);
  assert.equal((await fetch(server.url + "/static/widget.css")).status, 404);
  await assert.rejects(
    compileCatalogue(config),
    /component resource.*widget.css.*symlink/,
  );
});

test("requested closure retains unlinked CSS reported by a nested generated document", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      body: '<iframe src="../target/index.mobile.html" title="Target" />',
    }) +
      '\nmockups.push(defineScreen({ path: "target", title: "Target", description: "Nested generated document", relatedDocs: [], mobile: <main>Target</main>, desktop: <main>Target</main> }));',
    { extraConfig: 'renderer: "renderer.tsx",' },
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "widget.css"),
    "main { color: blue; }",
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => ({ html: '<html><body>' + renderToStaticMarkup(input.node) + '</body></html>', resources: input.entry.path === "target" ? [{ path: "widget.css", componentIds: ["action"] }] : [] });`,
  );
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const server = await startCatalogueServer(config, {
    port: 0,
    base: "main",
    manifest: runtime.manifest,
    componentRuntime: runtime,
  });
  fixture.beforeRemove(() => server.close());
  assert.equal((await fetch(server.url + "/static/widget.css")).status, 404);
  const home = await fetch(
    server.url + "/static/mokly-generated/home/index.mobile.html",
  );
  assert.equal(home.status, 200, await home.clone().text());
  assert.match(
    await home.text(),
    /<iframe[^>]*src="\.\.\/target\/index\.mobile\.html"/,
  );
  const css = await fetch(server.url + "/static/widget.css");
  assert.equal(css.status, 200);
  assert.equal(await css.text(), "main { color: blue; }");
  await assert.rejects(fs.access(config.generatedDir), { code: "ENOENT" });
});
