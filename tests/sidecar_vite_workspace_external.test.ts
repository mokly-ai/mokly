import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { reviewFixture } from "./fixtures/vite_review.js";
import { link, moduleNames, write } from "./helpers/native_resolution.js";

const entry = "src/review.mockup.ts";
const pkg = "packages/local";

async function workspace(
  context: TestContext,
  side: "head" | "base",
  build: string,
  source: string,
  name = "local",
) {
  const fixture = await reviewFixture(context, side);
  const [head] = fixture.params.repositoryRoots;
  assert.ok(head);
  await fs.unlink(path.join(head, "node_modules"));
  const manifest = JSON.stringify({
    name,
    type: "module",
    exports: `./${build}`,
  });
  await write(path.join(head, pkg, "package.json"), manifest);
  await write(path.join(head, pkg, build), 'export const value = "Built";');
  await write(path.join(head, pkg, source), 'export const value = "Head";');
  if (side === "base") {
    await fixture.write(`${pkg}/package.json`, manifest);
    await fixture.write(`${pkg}/${source}`, 'export const value = "Base";');
  }
  await link(path.join(head, pkg), path.join(head, "node_modules", name));
  await fixture.write(entry, `export { value } from ${JSON.stringify(name)};`);
  return fixture;
}

for (const side of ["head", "base"] as const) {
  test(`Vite ${side} compiles workspace source for a package in ssr.external`, async (context) => {
    const fixture = await workspace(
      context,
      side,
      "dist/value.js",
      "src/value.ts",
    );
    await fixture.write(
      "vite.config.mjs",
      'export default { ssr: { external: ["local"] } };',
    );
    const bundle = await fixture.compile();
    await fixture.sidecar.call("shutdown");
    assert.deepEqual(moduleNames(bundle).sort(), [
      `${pkg}/src/value.ts`,
      entry,
    ]);
  });
}

test("Vite base suggests sourcePackages for a missing workspace build", async (context) => {
  const fixture = await workspace(
    context,
    "base",
    "esm/value.js",
    "source/value.ts",
  );
  await assert.rejects(fixture.compile(), {
    code: "bundle-failed",
    message:
      /module packages\/local\/esm\/value\.js has no source in this side; set moduleResolution\.sourcePackages for local/,
  });
  await fixture.sidecar.call("shutdown");
});

test("esbuild keeps the missing-source message for an alias to a build path", async (context) => {
  const fixture = await workspace(
    context,
    "base",
    "esm/value.js",
    "source/value.ts",
  );
  const [head] = fixture.params.repositoryRoots;
  assert.ok(head);
  fixture.params.vite = false;
  fixture.params.moduleResolution.aliases = {
    "workspace-alias": path.join(head, pkg, "esm/value.js"),
  };
  await fixture.write(entry, 'export { value } from "workspace-alias";');

  await assert.rejects(fixture.compile(), {
    code: "bundle-failed",
    message:
      "src/review.mockup.ts:1:23: module packages/local/esm/value.js has no source in this side",
  });
  await fixture.sidecar.call("shutdown");
});

test("Vite base compiles a workspace style library through its wrapper", async (context) => {
  const fixture = await workspace(
    context,
    "base",
    "dist/value.js",
    "src/value.ts",
    "styled-components",
  );
  await fixture.write(
    "vite.config.mjs",
    "export default { ssr: { noExternal: true } };",
  );
  const bundle = await fixture.compile();
  await fixture.sidecar.call("shutdown");
  assert.deepEqual(moduleNames(bundle).sort(), [`${pkg}/src/value.ts`, entry]);
});

async function nativeReactWorkspace(context: TestContext) {
  const fixture = await workspace(
    context,
    "base",
    "dist/value.js",
    "src/value.js",
    "react",
  );
  const [head] = fixture.params.repositoryRoots;
  assert.ok(head);
  const manifest = JSON.stringify({
    name: "react",
    type: "module",
    exports: {
      ".": "./dist/value.js",
      "./jsx-runtime": "./dist/runtime.js",
      "./jsx-dev-runtime": "./dist/runtime.js",
    },
  });
  await write(path.join(head, pkg, "package.json"), manifest);
  await write(
    path.join(head, pkg, "dist/runtime.js"),
    'export const jsx = "Head";',
  );
  await fixture.write(`${pkg}/package.json`, manifest);
  await fixture.write(`${pkg}/src/runtime.js`, 'export const jsx = "Base";');
  return fixture;
}

test("Vite base uses Node-loadable source for a missing native React workspace build", async (context) => {
  const fixture = await nativeReactWorkspace(context);
  const bundle = await fixture.compile();
  await fixture.sidecar.call("shutdown");
  assert.equal(
    bundle.compiled.peers.react,
    await fs.realpath(path.join(fixture.root, pkg, "src/value.js")),
  );
});

test("Vite base keeps an existing React build and recovers a missing React subpath", async (context) => {
  const fixture = await nativeReactWorkspace(context);
  await fixture.write(
    `${pkg}/dist/value.js`,
    'export const value = "Base build";',
  );

  const bundle = await fixture.compile();
  await fixture.sidecar.call("shutdown");
  assert.equal(
    bundle.compiled.peers.react,
    await fs.realpath(path.join(fixture.root, pkg, "dist/value.js")),
  );
  assert.equal(
    bundle.compiled.peers["react/jsx-runtime"],
    await fs.realpath(path.join(fixture.root, pkg, "src/runtime.js")),
  );
});
