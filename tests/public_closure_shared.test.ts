import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { validateHtmlLinks } from "../dist/build/html_links.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { capturePublicFiles } from "../dist/export/public_files.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { discoverWatchResources } from "../dist/server/watch_resources.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

const body =
  '<a href="../../guide.html">Guide</a><a href="../../spec.pdf">PDF</a>' +
  '<span data-nav-href="../../nav.html">Navigate</span>' +
  '<link rel="preload" href="../../hint.woff2" as="font" />' +
  '<iframe src="../../frame.html" /><img srcSet="../../one.svg 1x, ../../two.svg 2x" />';

test("Build and Watch share every authored link and renderer resource edge", async (t) => {
  const fixture = await createFixture(
    componentEntrySource({
      body: body + '<action.Component label="Closure" />',
    }),
    {
      extraConfig: 'renderer: "renderer.tsx",',
    },
  );
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server";
export default input => '<html><head><link rel="stylesheet" href="' + '../'.repeat(input.entry.path.split('/').length + 1) + 'widget.css"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  t.after(() => removeFixture(fixture));
  for (const [name, content] of Object.entries({
    "guide.html":
      '<html><head><link rel="stylesheet" href="guide.css"></head><body>Guide</body></html>',
    "guide.css": "body { color: blue; }",
    "widget.css": "button { color: blue; }",
    "spec.pdf": "%PDF-1.4\nfixture",
    "nav.html": "<html><body>Navigation</body></html>",
    "hint.woff2": "font",
    "frame.html": "<html><body>Frame</body></html>",
    "one.svg": "<svg/>",
    "two.svg": "<svg/>",
  }))
    await fs.writeFile(path.join(fixture.mockupsDir, name), content);
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const watch = await discoverWatchResources(config, compiled);
  assert.deepEqual([...watch.closure].sort(), [
    ...compiled.manifest.assetClosure,
  ]);
  assert.ok(watch.closure.has("spec.pdf"));
  assert.ok(watch.closure.has("guide.css"));
  assert.ok(watch.closure.has("widget.css"));
});

test("on-demand previews include authored navigation closure before full completion", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<a href="../../guide.html">Guide</a>' }),
  );
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "guide.html"),
    '<link rel="stylesheet" href="guide.css"><p>Guide</p>',
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "guide.css"),
    "p { color: blue }",
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
  assert.equal(
    (await fetch(server.url + "/static/mokly-generated/home/index.mobile.html"))
      .status,
    200,
  );
  assert.equal((await fetch(server.url + "/static/guide.html")).status, 200);
  assert.equal((await fetch(server.url + "/static/guide.css")).status, 200);
});

test("renderer resource seeds cannot bypass the shared public-file policy", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.mockupsDir, ".private"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, ".private/key.css"),
    "secret {}",
  );
  const config = await loadConfig(fixture.root);
  assert.throws(
    () =>
      validateHtmlLinks(
        new Map([["home/index.html", "<p>Home</p>"]]),
        config,
        undefined,
        [".private/key.css"],
      ),
    /protected target.*hidden/,
  );
});

test("referenced authored module extensions and build-folder names are public", async (t) => {
  const fixture = await createFixture(
    validEntrySource({
      body: '<a href="../../app.js">Script</a><img src="../../dist/logo.svg" />',
    }),
  );
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.mockupsDir, "dist"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "app.js"),
    "export const example = true;",
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "dist/logo.svg"), "<svg/>");
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  assert.deepEqual(compiled.manifest.assetClosure, ["app.js", "dist/logo.svg"]);
  const files = await capturePublicFiles(
    config,
    compiled.outputs,
    compiled.manifest.assetClosure,
  );
  assert.equal(files.get("app.js")?.toString(), "export const example = true;");
});

test("Serve rejects replacement symlinks at a closure file and its ancestor", async (t) => {
  const fixture = await createFixture(
    validEntrySource({ body: '<img src="../../assets/logo.svg" />' }),
  );
  t.after(() => removeFixture(fixture));
  await fs.mkdir(path.join(fixture.mockupsDir, "assets"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "assets/logo.svg"),
    "<svg/>",
  );
  await fs.writeFile(path.join(fixture.mockupsDir, "private.svg"), "private");
  const config = await loadConfig(fixture.root);
  const compiled = await compileCatalogue(config);
  const server = await startCatalogueServer(config, {
    port: 0,
    base: "main",
    manifest: compiled.manifest,
  });
  fixture.beforeRemove(() => server.close());
  await fs.rm(path.join(fixture.mockupsDir, "assets/logo.svg"));
  await fs.symlink(
    "../private.svg",
    path.join(fixture.mockupsDir, "assets/logo.svg"),
  );
  for (const method of ["GET", "HEAD"])
    assert.equal(
      (await fetch(server.url + "/static/assets/logo.svg", { method })).status,
      404,
    );
  await fs.rm(path.join(fixture.mockupsDir, "assets"), { recursive: true });
  await fs.mkdir(path.join(fixture.mockupsDir, "hidden-target"));
  await fs.writeFile(
    path.join(fixture.mockupsDir, "hidden-target/logo.svg"),
    "private",
  );
  await fs.symlink("hidden-target", path.join(fixture.mockupsDir, "assets"));
  assert.equal(
    (await fetch(server.url + "/static/assets/logo.svg")).status,
    404,
  );
});
