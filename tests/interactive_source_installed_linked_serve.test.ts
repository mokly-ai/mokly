import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import {
  componentRuntimeMessage,
  parseRuntimeMessage,
} from "../dist/server/controls/runtime_ipc.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { installedLinkedFixture } from "./helpers/installed_linked.js";
import { acceptedStyles } from "./helpers/interactive_styles.js";

test("real Serve pins installed-to-repository requests after IPC and deletion", async (t) => {
  const fixture = await installedLinkedFixture();
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
  const route = "/static/screens/home.desktop.html";
  const html = await (await fetch(`${server.url}${route}`)).text();
  assert.match(html, /accepted-linked-source/);
  await fs.rm(path.join(fixture.linked, "index.ts"));
  assert.equal(
    (
      await fetch(
        `${server.url}/__mokly/interactive/${runtime.generation}/prepare`,
        {
          headers: { origin: server.url },
          method: "POST",
        },
      )
    ).status,
    200,
  );
  const bundle = await fetch(
    `${server.interactiveOrigin}/__mokly/interactive/${runtime.generation}/bundle.js`,
  );
  assert.equal(bundle.status, 200);
  assert.match(await bundle.text(), /accepted-linked-source/);
  assert.equal(
    (await fetch(`${server.interactiveOrigin}${route}`)).status,
    200,
  );
  assert.equal(await (await fetch(`${server.url}${route}`)).text(), html);
  assert.doesNotMatch(
    await (await fetch(`${server.url}/__mokly/catalogue.json`)).text(),
    /interactiveSources|"resolutions"|"type":"installed"|node_modules\/outer-package\/index\.js/,
  );
});
