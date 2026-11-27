import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { SourcePackage } from "../packages/mokly/src/generated/sidecar/SourcePackage.js";
import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";
import { jsonObject } from "../packages/mokly/src/sidecar/config-json.js";

import { viteFixtureWorker } from "./fixtures/vite/support.js";
import { reviewPage } from "./fixtures/vite_review.js";
import {
  buildValue,
  entry,
  pkg,
  probe,
  renderWorkspacePage,
  sides,
  sourceValue,
  stylesheet,
  workspace,
} from "./fixtures/vite_workspace.js";
import { moduleNames } from "./helpers/native_resolution.js";

for (const side of sides) {
  test(`Vite ${side} compiles a catalogue workspace import from source`, async (context) => {
    const fixture = await workspace(context, probe);
    await fixture.write(side, entry, 'export { value } from "local";');
    const params = fixture.params(side);
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const result = await sidecar.call<BundleResult>("bundle", params);
    await sidecar.call("shutdown");
    assert.deepEqual(moduleNames(result).sort(), [
      `${pkg}/src/value.ts`,
      entry,
    ]);
  });

  test(`Vite ${side} bundles a workspace import in its ESM config from source`, async (context) => {
    const fixture = await workspace(context, probe);
    await fixture.write(
      side,
      "vite.config.mjs",
      `
      import { value } from "local";
      export default { define: { __VALUE__: JSON.stringify(value) } };
    `,
    );
    await fixture.write(side, entry, reviewPage("__VALUE__"));
    const params = fixture.params(side);
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const html = await renderWorkspacePage(sidecar, params);
    await sidecar.call("shutdown");
    assert.equal(html, `<html><head></head><body>source ${side}</body></html>`);
  });

  test(`Vite ${side} compiles a JavaScript import of workspace CSS from source`, async (context) => {
    const fixture = await workspace(context, probe);
    await fixture.write(side, entry, 'import "local/theme.css";');
    const params = fixture.params(side);
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const result = await sidecar.call<BundleResult>("bundle", params);
    await sidecar.call("shutdown");
    assert.deepEqual(moduleNames(result).sort(), [
      `${pkg}/src/theme.css`,
      entry,
    ]);
  });

  test(`Vite ${side} compiles workspace files selected by an ordered setup resolver`, async (context) => {
    const fixture = await workspace(context, probe);
    const params = fixture.params(side);
    const head = await fs.realpath(fixture.roots.head);
    const builds = {
      local: path.join(head, pkg, probe.build),
      "local/theme.css": path.join(head, pkg, "dist/theme.css"),
    };
    const token = "data/resolve.txt";
    await fixture.write(side, token, "resolved");
    await fixture.write(
      side,
      "vite.config.mjs",
      `
      import { normalize, resolve } from "node:path";
      const builds = ${JSON.stringify(builds)};
      const headImporter = ${JSON.stringify(path.join(head, entry))};
      export default { plugins: [{ name: "workspace-build", resolveId: {
        order: "pre",
        handler(source, importer) {
          if (!Object.hasOwn(builds, source)) return;
          if (importer && normalize(importer) === headImporter)
            this.addWatchFile(resolve(import.meta.dirname, ${JSON.stringify(token)}));
          return builds[source];
        },
      } }] };
    `,
    );
    await fixture.write(
      side,
      entry,
      'export { value } from "local"; import "local/theme.css";',
    );
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const result = await sidecar.call<BundleResult>("bundle", params);
    await sidecar.call("shutdown");
    assert.deepEqual(moduleNames(result).sort(), [
      `${pkg}/src/theme.css`,
      `${pkg}/src/value.ts`,
      entry,
    ]);
    assert.equal(
      result.compiled.metadataInputs[token],
      createHash("sha256").update("resolved").digest("hex"),
    );
  });

  test(`Vite ${side} transforms a workspace stylesheet @import from source`, async (context) => {
    const fixture = await workspace(context, probe);
    await fixture.write(side, stylesheet, '@import "local/theme.css";');
    const params = fixture.params(side);
    const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
    const result = await sidecar.call<ViteCssResult>("transformViteCss", {
      setup: { ...params, entryFiles: [] },
      stylesheet,
      file: path.join(params.sourceRoot, stylesheet),
    });
    await sidecar.call("shutdown");
    assert.match(result.text, new RegExp(`\\.source-${side}\\s*\\{`));
  });
}

test("Vite base applies one workspace mapping in a bundled CommonJS config", async (context) => {
  const fixture = await workspace(context, {
    ...probe,
    sourcePackages: [{ local: { dist: "lib", lib: "src" } }],
  });
  const params = fixture.params("base");
  await fs.rm(path.join(params.sourceRoot, "vite.config.mjs"));
  await fixture.write(
    "base",
    "vite.config.cjs",
    'module.exports = { define: { __VALUE__: JSON.stringify(require("local").value) } };',
  );
  await fixture.write(
    "base",
    `${pkg}/lib/value.ts`,
    'export const value: string = "library base";',
  );
  await fixture.write("base", entry, reviewPage("__VALUE__"));

  const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
  const html = await renderWorkspacePage(sidecar, params);
  await sidecar.call("shutdown");
  assert.equal(html, "<html><head></head><body>library base</body></html>");
});

const fixtureData: unknown = JSON.parse(
  await fs.readFile(
    new URL("./fixtures/workspace-sources.json", import.meta.url),
    "utf8",
  ),
);
assert(jsonObject(fixtureData) && Array.isArray(fixtureData.compilePaths));
const cases: unknown[] = fixtureData.compilePaths;

function isPackageMap(value: unknown): value is Record<string, SourcePackage> {
  return (
    jsonObject(value) &&
    Object.values(value).every(
      (entry) =>
        entry === false ||
        (jsonObject(entry) &&
          Object.values(entry).every((folder) => typeof folder === "string")),
    )
  );
}

for (const row of cases) {
  assert(jsonObject(row));
  const {
    name,
    specifier,
    build,
    source,
    expected,
    sourcePackages = [],
    keepBaseBuild = false,
  } = row;
  assert(typeof name === "string" && typeof specifier === "string");
  assert(typeof build === "string" && typeof source === "string");
  assert(typeof expected === "string" && typeof keepBaseBuild === "boolean");
  assert(Array.isArray(sourcePackages) && sourcePackages.every(isPackageMap));

  for (const side of sides) {
    test(`esbuild and Vite ${side}: ${name}`, async (context) => {
      const fixture = await workspace(context, {
        specifier,
        build,
        source,
        sourcePackages,
        keepBaseBuild,
      });
      await fixture.write(
        side,
        entry,
        `export { value } from ${JSON.stringify(specifier)};`,
      );
      const digest = createHash("sha256")
        .update(keepBaseBuild ? buildValue(side) : sourceValue(side))
        .digest("hex");
      for (const [compiler, vite] of [
        ["esbuild", false],
        ["Vite", true],
      ] as const) {
        const params = fixture.params(side, vite);
        const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
        const result = await sidecar.call<BundleResult>("bundle", params);
        await sidecar.call("shutdown");
        assert.deepEqual(
          moduleNames(result).sort(),
          [expected, entry],
          compiler,
        );
        assert.equal(
          result.modules.find(({ path }) => path === expected)?.digest,
          digest,
          compiler,
        );
      }
    });
  }
}
