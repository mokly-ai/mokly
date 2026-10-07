import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { runtimeGraph } from "../dist/build/component_runtime.js";
import { DocumentCompiler } from "../dist/build/document_compiler.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { DocumentService } from "../dist/server/demand/service.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import {
  createFixture,
  removeFixture,
  validEntrySource,
} from "./helpers/fixture.js";

for (const reference of [
  "/absolute.svg",
  "../../notes.md",
  "../alias.svg",
  "../nested.css",
]) {
  test(`demand validation rejects unsafe transitive resources: ${reference}`, async (t) => {
    const fixture = await createFixture(
      validEntrySource({ body: `<img src="${reference}" alt="Example" />` }),
    );
    t.after(() => removeFixture(fixture));
    await fs.symlink(
      fixture.entryPath,
      path.join(fixture.mockupsDir, "alias.svg"),
    );
    await fs.writeFile(
      path.join(fixture.mockupsDir, "nested.css"),
      '@import "alias.svg";',
    );
    const config = await loadConfig(fixture.root);
    const runtime = await prepareLiveRuntime(config);
    const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
    assert.throws(() => compiler.render("home/index.desktop.html"), /invalid/);
    await assert.rejects(compileCatalogue(config), /invalid/);
  });
}

test(
  "saved preview timeout terminates consumer execution and the next view recovers",
  { timeout: 10000 },
  async (t) => {
    const fixture = await createFixture(
      validEntrySource({ body: "<Hang />" }) +
        "\nfunction Hang() { while (true) {} }",
    );
    t.after(() => removeFixture(fixture));
    const runtime = await prepareLiveRuntime(await loadConfig(fixture.root));
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const service = new DocumentService(runtime, () => {}, { timeoutMs: 1000 });
    fixture.beforeRemove(() => service.close());
    let settled = false;
    const pending = service.read("home/index.desktop.html");
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await new Promise(setImmediate);
    t.mock.timers.tick(999);
    await new Promise(setImmediate);
    assert.equal(settled, false, "the render stays pending before the timeout");
    t.mock.timers.tick(1);
    await new Promise(setImmediate);
    assert.equal(settled, true, "the render settles at the timeout boundary");
    await assert.rejects(pending, /too long/);
    assert.match(
      (await service.read("details/index.desktop.html")).html,
      /id="details"/,
    );
  },
);

test("metadata and complete catalogue adoption require the current generation", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const runtime = await prepareLiveRuntime(config);
  const server = await startCatalogueServer(config, {
    base: "main",
    port: 0,
    manifest: runtime.manifest,
    componentRuntime: runtime,
  });
  fixture.beforeRemove(() => server.close());
  const metadata = `${server.url}/__mokly/views/home/index.desktop.html`;
  assert.equal((await fetch(`${metadata}?generation=stale`)).status, 409);
  const response = await fetch(`${metadata}?generation=${runtime.generation}`);
  const data = await response.json();
  assert.equal(data.generation, runtime.generation);
  assert.equal(data.usage.viewport, "desktop");
  const complete = await compileCatalogue(config);
  assert.equal(
    server.completeCatalogue!(complete.manifest, "f".repeat(32)),
    false,
  );
  assert.match(
    await (await fetch(`${server.url}/view/home/`)).text(),
    /"usageComplete":false/,
  );
  assert.equal(
    server.completeCatalogue!(complete.manifest, runtime.generation),
    true,
  );
  assert.doesNotMatch(
    await (await fetch(`${server.url}/view/home/`)).text(),
    /"usageComplete":false/,
  );
  server.replaceComponentRuntime({ ...runtime, generation: "a".repeat(32) });
  assert.equal(
    server.completeCatalogue!(complete.manifest, runtime.generation),
    false,
  );
});
