import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { viteFixtureWorker } from "./fixtures/vite/support.js";
import { reviewPage } from "./fixtures/vite_review.js";
import {
  entry,
  pkg,
  probe,
  renderWorkspacePage,
  workspace,
} from "./fixtures/vite_workspace.js";

test("Vite replaces the worker when sourcePackages changes for config and catalogue imports", async (context) => {
  const fixture = await workspace(context, probe);
  const params = fixture.params("head");
  await fixture.write(
    "head",
    "vite.config.mjs",
    `
    import { value } from "local";
    export default { define: { __VALUE__: JSON.stringify(value) } };
    `,
  );
  await fixture.write(
    "head",
    entry,
    reviewPage('__VALUE__ + " / " + value', 'import { value } from "local";'),
  );
  const worker = await viteFixtureWorker(context, params.sourceRoot);
  assert.equal(
    await renderWorkspacePage(worker.sidecar, params),
    "<html><head></head><body>source head / source head</body></html>",
  );

  params.moduleResolution.sourcePackages = [{ local: false }];
  await assert.rejects(worker.sidecar.call("bundle", params), {
    code: "fresh-worker-required",
    message: "Vite needs a fresh worker process",
  });
  await worker.replaceWorker();
  assert.equal(
    await renderWorkspacePage(worker.sidecar, params),
    "<html><head></head><body>built head / built head</body></html>",
  );
  await worker.sidecar.call("shutdown");
});

test("Vite recompiles config and catalogue imports when a build becomes the renderer", async (context) => {
  const fixture = await workspace(context, probe);
  const params = fixture.params("head");
  const build = `${pkg}/${probe.build}`;
  await fixture.write(
    "head",
    build,
    'export const value = "built head"; export default ({ node }) => node;',
  );
  await fixture.write(
    "head",
    "vite.config.mjs",
    `import { value } from "local";
     export default { define: { __VALUE__: JSON.stringify(value) } };`,
  );
  await fixture.write(
    "head",
    entry,
    reviewPage('__VALUE__ + " / " + value', 'import { value } from "local";'),
  );
  const worker = await viteFixtureWorker(context, params.sourceRoot);
  assert.equal(
    await renderWorkspacePage(worker.sidecar, params),
    "<html><head></head><body>source head / source head</body></html>",
  );

  params.renderer = build;
  await assert.rejects(worker.sidecar.call("bundle", params), {
    code: "fresh-worker-required",
  });
  await worker.replaceWorker();
  assert.equal(
    await renderWorkspacePage(worker.sidecar, params),
    "<html><head></head><body>built head / built head</body></html>",
  );
  await worker.sidecar.call("shutdown");
});

test("computed CommonJS loads JavaScript with native priority", async (context) => {
  const fixture = await workspace(context, {
    ...probe,
    source: "src/value.js",
  });
  for (const [side, expected] of [
    ["head", "built head"],
    ["base", "source base"],
  ] as const) {
    const params = fixture.params(side);
    await fs.rm(path.join(params.sourceRoot, "vite.config.mjs"));
    await fixture.write(side, "vite.config.cjs", computedConfig);
    await fixture.write(
      side,
      `${pkg}/src/value.js`,
      `export const value = "source ${side}";`,
    );
    await fixture.write(side, entry, reviewPage("__VALUE__"));
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const html = await renderWorkspacePage(sidecar, params);
    await sidecar.call("shutdown");
    assert.equal(html, `<html><head></head><body>${expected}</body></html>`);
  }
});

test("Vite base suggests sourcePackages for a missing computed CommonJS build", async (context) => {
  const fixture = await workspace(context, {
    ...probe,
    build: "esm/value.js",
    source: "source/value.ts",
  });
  const params = fixture.params("base");
  await fs.rm(path.join(params.sourceRoot, "vite.config.mjs"));
  await fixture.write("base", "vite.config.cjs", computedConfig);
  await fixture.write("base", entry, reviewPage("__VALUE__"));
  const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
  await assert.rejects(sidecar.call("bundle", params), {
    code: "bundle-failed",
    message:
      /module packages\/local\/esm\/value\.js has no source in this side; set moduleResolution\.sourcePackages for local/,
  });
  await sidecar.call("shutdown");
});

const computedConfig = `
  const name = "local";
  module.exports = { define: { __VALUE__: JSON.stringify(require(name).value) } };
`;
