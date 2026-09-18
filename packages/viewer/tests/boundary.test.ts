import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");

test("the browser hydration entry is a documented package subpath", async () => {
  const manifest = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  ) as { exports: Record<string, unknown>; sideEffects: string[] };
  assert.deepEqual(manifest.exports["./browser"], {
    types: "./dist/browser.d.ts",
    import: "./dist/browser.js",
  });
  assert.ok(manifest.sideEffects.includes("./dist/browser.js"));
});

test("React entry bundles for browsers without CLI, server or Node code", async () => {
  const result = await build({
    entryPoints: [path.join(root, "src/index.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    metafile: true,
    logLevel: "silent",
  });
  for (const input of Object.keys(result.metafile.inputs))
    assert.doesNotMatch(
      input,
      /(?:^|\/)src\/(?:cli|server|build)\/|viewer\/server\.(?:js|tsx)$/,
    );
});
test("standalone browser modules isolate React to the hydration bundle", async () => {
  const directories = [
    path.join(root, "dist/browser"),
    path.resolve(root, "../../dist/browser"),
  ];
  let hydrationBundles = 0;
  for (const directory of directories) {
    for (const file of await fs.readdir(directory)) {
      if (!file.endsWith(".js")) continue;
      const code = await fs.readFile(path.join(directory, file), "utf8");
      assert.doesNotMatch(code, /from\s*["']node:/);
      if (file === "react-shell.js") {
        hydrationBundles++;
        assert.match(code, /hydrateRoot/);
      } else {
        assert.doesNotMatch(
          code,
          /from\s*["']react(?:-dom)?|react-dom|hydrateRoot|react\.production/,
        );
      }
    }
  }
  assert.equal(hydrationBundles, 1);
});
test("the Node-only SSR entry cannot be imported into a browser graph", async () => {
  await assert.rejects(
    build({
      stdin: {
        contents:
          'import { renderViewer } from "@mokly/viewer/server"; console.log(renderViewer);',
        resolveDir: root,
      },
      bundle: true,
      write: false,
      platform: "browser",
      logLevel: "silent",
    }),
  );
});
