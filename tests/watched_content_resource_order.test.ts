import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";
import type { WatchEvent } from "../dist/server/watch_events.js";

import { removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";
import { contentVersion, watchedEvents } from "./helpers/watched_events.js";

async function text(url: string): Promise<string> {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  return response.text();
}

test(
  "in-process server installs an accepted stylesheet before announcing its content update",
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
    const stylesheet = `${server.url}/static/mokly-generated/${entryStyle}`;
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

test(
  "watched Serve's child serves rebuilt imported CSS when it announces the in-place content update",
  { timeout: 60_000 },
  async (context) => {
    const fixture = await styleFixture(".theme{color:red}", {
      extraConfig: "watch: { debounceMs: 0 },",
    });
    context.after(() => removeFixture(fixture));
    const source = path.join(fixture.entriesDir, "fixture.css");
    const diagnostics: string[] = [];
    let changed: ((event: WatchEvent) => void) | undefined;
    const running = await serve(
      await loadConfig(fixture.root),
      { port: 0, watch: true },
      {
        reporter: new PlainServeReporter((value) => diagnostics.push(value)),
        watcherFactory: {
          create: () => ({
            async ready() {},
            async close() {},
            onError() {},
            onChange(callback) {
              changed ??= callback;
            },
          }),
        },
      },
    );
    fixture.beforeRemove(() => running.close());
    const controller = new AbortController();
    context.after(() => controller.abort());
    const stylesheet = `${running.url}/static/mokly-generated/${entryStyle}`;
    let edited = false;
    for await (const event of watchedEvents(
      await fetch(`${running.url}/__mokly/events`, {
        signal: controller.signal,
      }),
    )) {
      if (!edited) {
        edited = true;
        assert.equal(event.kind, "ready");
        assert.match(await text(stylesheet), /color: red/u);
        await fs.writeFile(source, ".theme{color:blue}");
        assert.ok(changed, "watched Serve registered a source watcher");
        changed({ path: source, kind: "change" });
        continue;
      }
      const css = await text(stylesheet);
      if (contentVersion(await text(running.url)) !== event.version) continue;
      assert.equal(event.kind, "update");
      assert.match(css, /color: blue/u);
      return;
    }
    assert.fail(
      `the child's event stream closed before an in-place content update; diagnostics: ${diagnostics.join("")}`,
    );
  },
);
