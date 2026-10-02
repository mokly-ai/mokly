import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";

import { removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";

test(
  "content update serves the accepted stylesheet before announcing its version",
  { timeout: 30_000 },
  async (context) => {
    const fixture = await styleFixture(".theme{color:red}");
    context.after(() => removeFixture(fixture));
    const config = await loadConfig(fixture.root);
    const initial = await prepareLiveRuntime(config);
    const server = await startCatalogueServer(config, {
      base: "main",
      componentRuntime: initial,
      manifest: initial.manifest,
      port: 0,
    });
    context.after(() => server.close());
    const controller = new AbortController();
    context.after(() => controller.abort());
    const stream = await fetch(`${server.url}/__mokly/events`, {
      signal: controller.signal,
    });
    assert.equal(stream.status, 200);
    assert.ok(stream.body);
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    const ready = await reader.read();
    assert.match(decoder.decode(ready.value), /event: ready\ndata: 1/u);
    const stylesheet = `${server.url}/static/${entryStyle}`;
    assert.match(await (await fetch(stylesheet)).text(), /color: red/u);

    await fs.writeFile(
      path.join(fixture.entriesDir, "fixture.css"),
      ".theme{color:blue}",
    );
    const next = await prepareLiveRuntime(config);
    server.replaceComponentRuntime(next);
    server.publishUpdate({ version: 2 });
    const update = await reader.read();
    assert.match(decoder.decode(update.value), /event: update\ndata: 2/u);
    assert.match(await (await fetch(stylesheet)).text(), /color: blue/u);
    assert.match(
      await (await fetch(server.url)).text(),
      /data-mokly-content-version="2"/u,
    );
    await reader.cancel();
  },
);
