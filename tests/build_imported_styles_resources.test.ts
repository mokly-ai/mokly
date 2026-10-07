import assert from "node:assert/strict";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { extractCssReferences } from "../dist/css_references.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import { textOutput } from "./helpers/generated_text.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

test("multiple on-demand views parse CSS only once per generation", async (t) => {
  const fixture = await styleFixture(".entry{color:red}");
  t.after(() => removeFixture(fixture));
  const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
  let cssParses = 0;
  const seams = {
    parseCss: (text) => {
      cssParses += 1;
      return extractCssReferences(text);
    },
  } satisfies ConstructorParameters<typeof DocumentCompiler>[2];
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime), seams);
  for (const route of [
    "home/index.mobile.html",
    "home/index.desktop.html",
    "home/index.mobile.html",
  ]) {
    assert.match(compiler.render(route).html, /\.\.\/styles\//);
  }
  assert.equal(cssParses, 1);
  const next = new DocumentCompiler(runtime, runtimeGraph(runtime), seams);
  assert.match(next.render("home/index.mobile.html").html, /\.\.\/styles\//);
  assert.equal(cssParses, 2);
});

test("pending CSS and assets validate without reading stale reserved disk files", async (t) => {
  const fixture = await styleFixture('.entry{background:url("./image.png")}');
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.entriesDir, "image.png"),
    Buffer.from([0, 255]),
  );
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const asset = "mokly-generated/assets/entries/image.png";
  const physical = path.join(fixture.mockupsDir, asset);
  await fs.mkdir(path.dirname(physical), { recursive: true });
  await fs.writeFile(physical, Buffer.from([255, 0]));
  const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
  assert.match(
    compiler.render("home/index.mobile.html").html,
    /\.\.\/styles\//,
  );
  const missingRuntime = {
    ...runtime,
    styleOutputs: runtime.styleOutputs.filter(
      ([route]) => route !== asset.slice("mokly-generated/".length),
    ),
  };
  assert.throws(
    () =>
      new DocumentCompiler(missingRuntime, runtimeGraph(missingRuntime)).render(
        "home/index.mobile.html",
      ),
    /missing target.*image\.png/,
  );
});

test("full compilation validates transitive public HTML resources", async (t) => {
  const fixture = await styleFixture(".entry{color:red}", {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'export default () => `<!doctype html><html><head></head><body><a href="../../public.html">Public</a></body></html>`;',
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "public.html"),
    '<!doctype html><html><body><img src="missing.png"></body></html>',
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /public\.html: missing target missing\.png/,
  );
});

test("full compilation never validates a missing reserved CSS target from disk", async (t) => {
  const fixture = await createFixture(validEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const stale = path.join(
    fixture.mockupsDir,
    "mokly-generated/styles/stale.css",
  );
  await fs.mkdir(path.dirname(stale), { recursive: true });
  await fs.writeFile(stale, ".stale{color:red}");
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    'export default () => `<!doctype html><html><head><link rel="stylesheet" href="../styles/stale.css"></head><body>View</body></html>`;',
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    /missing target .*styles\/stale\.css/,
  );
});

test("on-demand Serve sends accepted stylesheet and asset bytes over stale disk", async (t) => {
  const fixture = await styleFixture('.entry{background:url("./image.png")}');
  t.after(() => removeFixture(fixture));
  const assetBytes = Buffer.from([0, 255, 16]);
  await fs.writeFile(path.join(fixture.entriesDir, "image.png"), assetBytes);
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const cssRoute = "mokly-generated/styles/entries/fixture.mockup.tsx.css";
  const assetRoute = "mokly-generated/assets/entries/image.png";
  for (const route of [cssRoute, assetRoute]) {
    const file = path.join(fixture.mockupsDir, route);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, "old disk content");
  }
  const server = await startCatalogueServer(config, {
    base: "main",
    port: 0,
    manifest: runtime.manifest,
    componentRuntime: runtime,
  });
  fixture.beforeRemove(() => server.close());
  const css = await fetch(`${server.url}/static/${cssRoute}`);
  assert.equal(css.status, 200);
  assert.equal(
    await css.text(),
    new Map(runtime.styleOutputs).get(
      cssRoute.slice("mokly-generated/".length),
    ),
  );
  const asset = await fetch(`${server.url}/static/${assetRoute}`);
  assert.equal(asset.status, 200);
  assert.deepEqual(Buffer.from(await asset.arrayBuffer()), assetBytes);
  const head = await fetch(`${server.url}/static/${assetRoute}`, {
    method: "HEAD",
  });
  assert.equal(head.status, 200);
  assert.equal((await head.arrayBuffer()).byteLength, 0);
});

test("component HTML resources accept pending stylesheets before they exist on disk", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const styleRoute = "mokly-generated/styles/entries/fixture.mockup.tsx.css";
  await fs.writeFile(
    path.join(fixture.entriesDir, "card.css"),
    ".card{color:red}",
  );
  await fs.appendFile(fixture.entryPath, '\nimport "./card.css";');
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<!doctype html><html><head>' + input.stylesheets.map(href => '<link rel="stylesheet" href="' + href + '">').join('') + '</head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  assert.ok(compiled.outputs.has(styleRoute.slice("mokly-generated/".length)));
  const html = textOutput(compiled.outputs, "home/index.mobile.html")!;
  assert.match(html, /styles\/entries\/fixture\.mockup\.tsx\.css/);
  assert.ok(!fsSync.existsSync(path.join(fixture.mockupsDir, styleRoute)));
});

test("component resources reject stale reserved disk files absent from pending output", async (t) => {
  const fixture = await createFixture(componentEntrySource(), {
    extraConfig: 'renderer: "renderer.tsx",',
  });
  t.after(() => removeFixture(fixture));
  const missing = "mokly-generated/styles/stale.css";
  const stale = path.join(fixture.mockupsDir, missing);
  await fs.mkdir(path.dirname(stale), { recursive: true });
  await fs.writeFile(stale, ".stale{color:red}");
  await fs.writeFile(
    path.join(fixture.root, "renderer.tsx"),
    `import { renderToStaticMarkup } from "react-dom/server"; export default (input) => '<!doctype html><html><head><link rel="stylesheet" href="' + '../'.repeat(input.entry.path.split('/').length) + '${missing.slice("mokly-generated/".length)}"></head><body>' + renderToStaticMarkup(input.node) + '</body></html>';`,
  );
  await assert.rejects(
    compileCatalogue(await loadConfig(fixture.root)),
    (error: Error) => {
      assert.match(
        error.message,
        /missing target (?:\.\.\/)+styles\/stale\.css/,
      );
      assert.doesNotMatch(error.message, /escapes mockupsDir/);
      return true;
    },
  );
});

test("pending stylesheet delivery omits reserved disk orphans", async (t) => {
  const fixture = await styleFixture(".entry{color:red}");
  t.after(() => removeFixture(fixture));
  const stale = path.join(fixture.mockupsDir, "mokly-generated/styles/old.css");
  await fs.mkdir(path.dirname(stale), { recursive: true });
  await fs.writeFile(stale, "stale");
  const compiled = await compileCatalogue(await loadConfig(fixture.root));
  const html = compiled.outputs.get("home/index.mobile.html") as string;
  assert.match(html, /styles\/entries\/fixture\.mockup\.tsx\.css/);
  assert.doesNotMatch(html, /styles\/old\.css/);
});
