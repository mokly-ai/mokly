import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
export default input => '<html><head><link rel="stylesheet" href="' + '../'.repeat(input.entry.path.split('/').length + 1) + 'widget.css"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
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
