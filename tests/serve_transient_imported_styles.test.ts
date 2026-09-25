import assert from "node:assert/strict";
import fs from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import { handleControls } from "../dist/server/controls/http.js";
import { ComponentRenderService } from "../dist/server/controls/service.js";
import { captureRenderBundle } from "../dist/server/controls/transient_assets.js";

import { removeFixture } from "./helpers/fixture.js";
import { entryStyle, styleFixture } from "./helpers/imported_styles_fixture.js";

for (const mode of ["committed", "derived"] as const) {
  test(`${mode} transient HTTP delivers scoped CSS assets from memory for GET and HEAD`, async (context) => {
    const fixture = await styleFixture(
      '.entry{src:url("./node_modules/@fontsource/demo/files/font.woff2")}',
    );
    context.after(() => removeFixture(fixture));
    if (mode === "derived")
      await fs.writeFile(
        fixture.configPath,
        (await fs.readFile(fixture.configPath, "utf8")).replace(
          '"committed"',
          '"derived"',
        ),
      );
    const asset =
      "mokly-generated/assets/entries/node_modules/@fontsource/demo/files/font.woff2";
    const source = path.join(
      fixture.entriesDir,
      "node_modules/@fontsource/demo/files/font.woff2",
    );
    const original = Buffer.from([0, 255, 31]);
    await fs.mkdir(path.dirname(source), { recursive: true });
    await fs.writeFile(source, original);
    const config = await loadConfig(fixture.root);
    const compiled = await compileCatalogue(config);
    const route = "screens/home.mobile.html";
    const service = new ComponentRenderService(componentRuntime(compiled));
    fixture.beforeRemove(() => service.close());
    const rendered = service.store.put(
      {
        route,
        props: {},
        view: {
          viewport: "mobile",
          colorScheme: "light",
          instances: [],
          slots: [],
          ranges: [],
          styles: [],
          resources: [],
        },
        files: captureRenderBundle(
          route,
          compiled.outputs,
          compiled.manifest,
          config,
        ),
      },
      "synthetic-generation",
    );
    for (const candidate of [entryStyle, asset]) {
      const file = path.join(fixture.mockupsDir, candidate);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, "stale disk");
    }
    const server = http.createServer((request, response) => {
      void handleControls(request, response, service);
    });
    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    fixture.beforeRemove(
      () =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve())),
        ),
    );
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const endpoint = `http://127.0.0.1:${address.port}/__mokly/components/renders/${rendered.renderId}/`;
    for (const [name, expected, type] of [
      [
        entryStyle,
        Buffer.from(compiled.outputs.get(entryStyle) as string),
        "text/css",
      ],
      [asset, original, "font/woff2"],
    ] as const) {
      const url = `${endpoint}${name.replace("@fontsource", "%40fontsource")}`;
      for (const method of ["GET", "HEAD"] as const) {
        const response = await fetch(url, { method });
        assert.equal(response.status, 200);
        assert.match(
          response.headers.get("content-type") ?? "",
          new RegExp(type),
        );
        assert.deepEqual(
          Buffer.from(await response.arrayBuffer()),
          method === "GET" ? expected : Buffer.alloc(0),
        );
      }
    }
    const stale = `${endpoint}${asset.replace("font.woff2", "stale.woff2")}`;
    const staleFile = path.join(
      fixture.mockupsDir,
      asset.replace("font.woff2", "stale.woff2"),
    );
    await fs.writeFile(staleFile, "stale disk");
    for (const method of ["GET", "HEAD"] as const)
      assert.equal((await fetch(stale, { method })).status, 404);
  });
}
