import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { exportCatalogue } from "../dist/export/run.js";
import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { buildPreview } from "../scripts/preview/catalogue.mjs";

import { directoryFiles } from "./helpers/export_fixture.js";
import { installedLinkedFixture } from "./helpers/installed_linked.js";
import { installedStylesFixture } from "./helpers/installed_styles.js";
import { acceptedStyles } from "./helpers/interactive_styles.js";

const privateCapture =
  /interactiveSources|"resolutions"|"type":"installed"|node_modules\/(?:installed-style|outer-package)\/index\.js/;

for (const [label, create] of [
  ["stylesheet", installedStylesFixture],
  ["linked repository", installedLinkedFixture],
] as const) {
  test(`installed ${label} capture stays absent while off and outside generated output, static evidence, export and publication`, async (t) => {
    const fixture = await create();
    t.after(() => fixture.remove());
    const config = await loadConfig(fixture.root);
    const accepted = await prepareLiveRuntime(config);
    assert.ok(
      accepted.interactiveSources!.resolutions.some(
        ({ importer }) => importer.type === "installed",
      ),
    );
    const offConfig = { ...config, interactive: "off" as const };
    const offRuntime = await prepareLiveRuntime(offConfig);
    assert.equal(Object.hasOwn(offRuntime, "interactiveSources"), false);
    assert.equal(
      Object.hasOwn(
        componentRuntimeMessage(offRuntime).runtime,
        "interactiveSources",
      ),
      false,
    );
    const compiled = await compileCatalogue(config);
    const offCompiled = await compileCatalogue(offConfig);
    assert.equal(componentRuntime(compiled).interactiveSources, undefined);
    assert.deepEqual([...compiled.outputs], [...offCompiled.outputs]);
    assert.deepEqual(compiled.manifest, offCompiled.manifest);
    assert.doesNotMatch(JSON.stringify(compiled.manifest), privateCapture);
    assert.doesNotMatch(JSON.stringify(accepted.manifest), privateCapture);
    assert.ok(
      !compiled.manifest.sourceFiles.some((file) =>
        /^node_modules\/(?:installed-style|outer-package)\//.test(file),
      ),
    );
    for (const [route, bytes] of compiled.outputs)
      assert.doesNotMatch(Buffer.from(bytes).toString(), privateCapture, route);
    await writeCompilation(compiled, config);
    const exported = await exportCatalogue(config, {
      outDir: "site",
      noChanges: true,
    });
    const published = path.join(fixture.root, ".context/published");
    await buildPreview(config, published);
    for (const root of [exported.outDir, published]) {
      const files = await directoryFiles(root);
      assert.ok(files.has("__mokly/catalogue.json"));
      assert.equal(
        [...files.keys()].some((file) =>
          file.startsWith("__mokly/interactive/"),
        ),
        false,
      );
      for (const [route, bytes] of files)
        if (/\.(html|json|js|css)$/.test(route))
          assert.doesNotMatch(bytes.toString(), privateCapture, route);
    }
  });
}

test("real Serve compiles installed stylesheet requests after IPC and deletion while public JSON stays private", async (t) => {
  const fixture = await installedStylesFixture();
  t.after(() => fixture.remove());
  const accepted = await acceptedStyles(fixture.root);
  const transferred = parseRuntimeMessage(componentRuntimeMessage(accepted));
  assert.ok(transferred?.runtime.interactiveSources);
  assert.deepEqual(
    transferred.runtime.interactiveSources,
    accepted.interactiveSources,
  );
  const runtime = {
    ...accepted,
    interactiveSources: transferred.runtime.interactiveSources,
  };
  const server = await startCatalogueServer(runtime.config, {
    base: "main",
    changesStatus: "unavailable",
    componentRuntime: runtime,
    manifest: runtime.manifest,
    port: 0,
    interactivePort: 0,
  });
  fixture.beforeRemove(() => server.close());
  const staticHtml = await (
    await fetch(`${server.url}/static/home/index.desktop.html`)
  ).text();
  const name = staticHtml.match(/data-module="([^"]+)"/)?.[1];
  assert.ok(name);
  await fs.rm(path.join(fixture.directory, "card.module.css"));
  await fs.rm(path.join(fixture.directory, "plain.css"));
  const prepared = await fetch(
    `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
    {
      headers: { origin: server.url },
      method: "POST",
    },
  );
  assert.equal(prepared.status, 200);
  const bundle = await fetch(
    `${server.interactiveOrigin}/__mokly/interactive/${runtime.generation}/bundle.js`,
  );
  assert.equal(bundle.status, 200);
  assert.ok((await bundle.text()).includes(name));
  const live = await fetch(
    `${server.interactiveOrigin}/static/home/index.desktop.html`,
  );
  assert.equal(live.status, 200);
  assert.ok((await live.text()).includes(name));
  const staticAfter = await fetch(
    `${server.url}/static/home/index.desktop.html`,
  );
  assert.equal(staticAfter.status, 200);
  assert.equal(await staticAfter.text(), staticHtml);
  assert.doesNotMatch(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).text(),
    privateCapture,
  );
});
