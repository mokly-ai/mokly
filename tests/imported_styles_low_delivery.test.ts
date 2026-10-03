import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { writeCompilation } from "../dist/build/transaction.js";
import { loadConfig } from "../dist/config/load.js";
import { captureRenderBundle } from "../dist/server/controls/transient_assets.js";
import { startCatalogueServer } from "../dist/server/http.js";
import { serve } from "../dist/server/serve.js";

import { removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

const MIME_TYPES = new Map([
  ["avif", "image/avif"],
  ["bmp", "image/bmp"],
  ["gif", "image/gif"],
  ["ico", "image/vnd.microsoft.icon"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["webp", "image/webp"],
  ["eot", "application/vnd.ms-fontobject"],
  ["otf", "font/otf"],
  ["ttf", "font/ttf"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"],
]);

for (const mode of ["committed", "derived"] as const) {
  test(
    `${mode} generated assets have specific types in static, on-demand and transient delivery`,
    {
      timeout: 60_000,
    },
    async (context) => {
      const fixture = await styleFixture(
        `.entry { ${[...MIME_TYPES.keys()].map((extension) => `--asset-${extension}: url("./asset.${extension}");`).join(" ")} }`,
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
      for (const extension of MIME_TYPES.keys())
        await fs.writeFile(
          path.join(fixture.entriesDir, `asset.${extension}`),
          Buffer.from([0, 255, 42]),
        );
      const config = await loadConfig(fixture.root);
      const compiled = await compileCatalogue(config);
      if (mode === "committed") await writeCompilation(compiled, config);
      const staticServer = await startCatalogueServer(config, {
        base: "main",
        port: 0,
        ...(mode === "derived"
          ? {
              manifest: compiled.manifest,
              componentRuntime: componentRuntime(compiled),
            }
          : {}),
      });
      fixture.beforeRemove(() => staticServer.close());
      const onDemand = await serve(config, { port: 0, watch: false });
      fixture.beforeRemove(() => onDemand.close());
      const documentRoute = [...compiled.outputs.keys()].find((route) =>
        route.endsWith(".html"),
      )!;
      const preview = captureRenderBundle(
        documentRoute,
        compiled.outputs,
        compiled.manifest,
        config,
      );
      for (const [extension, type] of MIME_TYPES) {
        const route = `mokly-generated/assets/entries/asset.${extension}`;
        assert.equal(preview.get(route)?.type, type, `transient ${extension}`);
        for (const url of [staticServer.url, onDemand.url]) {
          const response = await fetch(`${url}/static/${route}`);
          assert.equal(response.status, 200, `${url} ${route}`);
          assert.equal(
            response.headers.get("content-type"),
            type,
            `${url} ${route}`,
          );
          assert.deepEqual(
            Buffer.from(await response.arrayBuffer()),
            Buffer.from([0, 255, 42]),
          );
        }
      }
    },
  );
}
