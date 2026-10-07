import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { IsolatedPostcssProcessor } from "../dist/build/styles/isolated_postcss.js";
import { loadConfig } from "../dist/config/load.js";
import { isCancellation } from "../dist/errors.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import { styleFixture } from "./helpers/imported_styles_fixture.js";

test("an already cancelled compilation starts no PostCSS processor", async (t) => {
  const fixture = await styleFixture(".entry{color:blue}", {
    extraConfig: 'postcss: "postcss.config.mjs",',
  });
  t.after(() => removeFixture(fixture));
  await fs.writeFile(
    path.join(fixture.root, "postcss.config.mjs"),
    "export default { plugins: [] };",
  );
  const config = await loadConfig(fixture.root);
  const started = t.mock.method(IsolatedPostcssProcessor.prototype, "start");
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    compileCatalogue(config, undefined, controller.signal),
    isCancellation,
  );
  assert.equal(
    started.mock.callCount(),
    0,
    "cancelled work must not start a graph processor",
  );
});

test("cancellation in one renderer prevents every later view render", async (t) => {
  const fixture = await createFixture(undefined, {
    extraConfig: 'renderer: "renderer.ts",',
  });
  t.after(() => removeFixture(fixture));
  const controller = new AbortController();
  let renders = 0;
  Object.defineProperty(globalThis, "__moklyCancelRender", {
    configurable: true,
    value: () => {
      renders++;
      controller.abort();
    },
  });
  t.after(() => {
    Reflect.deleteProperty(globalThis, "__moklyCancelRender");
  });
  await fs.writeFile(
    path.join(fixture.root, "renderer.ts"),
    `export default () => {
    globalThis.__moklyCancelRender();
    return "<!doctype html><html><head><title>Fixture</title></head><body>Fixture</body></html>";
  };`,
  );
  await assert.rejects(
    compileCatalogue(
      await loadConfig(fixture.root),
      undefined,
      controller.signal,
    ),
    isCancellation,
  );
  assert.equal(
    renders,
    1,
    "only the renderer that requested cancellation may run",
  );
});
