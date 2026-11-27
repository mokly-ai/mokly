import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import type { SourcePackage } from "../packages/mokly/src/generated/sidecar/SourcePackage.js";
import type { ViteCssResult } from "../packages/mokly/src/generated/sidecar/ViteCssResult.js";
import { jsonObject } from "../packages/mokly/src/sidecar/config-json.js";

import { viteFixture, viteFixtureWorker } from "./fixtures/vite/support.js";
import { reviewPage } from "./fixtures/vite_review.js";
import {
  link,
  moduleNames,
  nativeParams,
  write,
} from "./helpers/native_resolution.js";
import { installBindings } from "./helpers/sidecar.js";

const sides = ["head", "base"] as const;
type Side = (typeof sides)[number];

const pkg = "packages/local";
const entry = "src/workspace.mockup.ts";
const stylesheet = "src/workspace.css";
const buildValue = (side: Side) => `export const value = "built ${side}";`;
const sourceValue = (side: Side) =>
  `export const value: string = "source ${side}";`;

interface Layout {
  specifier: string;
  build: string;
  source: string;
  sourcePackages?: Record<string, SourcePackage>[];
  keepBaseBuild?: boolean;
}

async function workspace(context: TestContext, layout: Layout) {
  const fixture = await viteFixture(context);
  const head = fixture.root;
  const roots = { head, base: path.join(fixture.parent, "extraction") };
  await fs.rm(path.join(head, "node_modules"), { recursive: true });
  await link(
    path.join(head, pkg),
    path.join(head, "node_modules", layout.specifier),
  );
  const writeSide = (side: Side, file: string, contents: string) =>
    write(path.join(roots[side], file), contents);

  for (const side of sides) {
    await writeSide(side, "vite.config.mjs", "export default {};");
    await writeSide(
      side,
      `${pkg}/package.json`,
      JSON.stringify({
        name: layout.specifier,
        type: "module",
        exports: {
          ".": `./${layout.build}`,
          "./theme.css": "./dist/theme.css",
        },
      }),
    );
    await writeSide(side, `${pkg}/${layout.source}`, sourceValue(side));
    await writeSide(
      side,
      `${pkg}/src/theme.css`,
      `.source-${side} { color: teal }`,
    );
  }
  await writeSide("head", `${pkg}/${layout.build}`, buildValue("head"));
  await writeSide(
    "head",
    `${pkg}/dist/theme.css`,
    ".built-head { color: red }",
  );
  if (layout.keepBaseBuild)
    await writeSide("base", `${pkg}/${layout.build}`, buildValue("base"));

  return {
    write: writeSide,
    params: (side: Side, vite = true) =>
      nativeParams(
        roots[side],
        { vite, repositoryRoots: [head], entryFiles: [entry] },
        {
          ...(side === "base" ? { dependencyRoot: head } : {}),
          packageRoots: [head, ...fixture.params.moduleResolution.packageRoots],
          sourcePackages: layout.sourcePackages ?? [],
        },
      ),
  };
}

const probe = {
  specifier: "local",
  build: "dist/value.js",
  source: "src/value.ts",
};

async function renderWorkspacePage(context: TestContext, params: BundleParams) {
  const { sidecar } = await viteFixtureWorker(context, params.sourceRoot);
  const { generation } = await sidecar.call<BundleResult>("bundle", params);
  await installBindings(sidecar, generation);
  const result = await sidecar.call<PageResult>("renderPage", {
    generation,
    handle: `${entry}#page`,
  });
  await sidecar.call("shutdown");
  return result.html;
}

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
    assert.equal(
      await renderWorkspacePage(context, fixture.params(side)),
      `<html><head></head><body>source ${side}</body></html>`,
    );
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

  assert.equal(
    await renderWorkspacePage(context, params),
    "<html><head></head><body>library base</body></html>",
  );
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
