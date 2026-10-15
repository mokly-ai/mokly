import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  cssParams,
  startSidecar,
} from "./helpers/sidecar.js";

test("generation identity includes entry membership in an unchanged module graph", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const params = bundleParams({
    entryFiles: ["screen.mockup.tsx"],
    renderer: null,
    storiesFiles: [],
  });
  const first = await sidecar.call<BundleResult>("bundle", params);
  const second = await sidecar.call<BundleResult>("bundle", {
    ...params,
    entryFiles: [...params.entryFiles, "component.mockup.tsx"],
  });
  assert.notEqual(first.generation, second.generation);
});

test("TypeScript assertions, fixture arrays, and ordinary props work together", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["review.mockup.ts"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation,
  });
  assert.deepEqual(definitions.diagnostics, []);
  assert.equal(definitions.warnings.length, 1);
  await installBindings(sidecar, generation);
  for (let i = 0; i < 2; i++) {
    const result = await sidecar.call<RenderResult>("renderScreen", {
      generation,
      handle: "review.mockup.ts#screen",
      entry: { path: "review", title: "Review" },
      props: { label: "plain" },
      viewport: "mobile",
      colorScheme: "light",
    });
    assert.equal(result.html, "plain");
    assert.deepEqual(result.warnings, []);
  }
});

test("missing PostCSS module errors name the module and keep bundle-failed", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call("processCss", cssParams({ postcss: "missing.mjs" })),
    { code: "bundle-failed", message: /missing.mjs/ },
  );
});

test("definition shape and reference diagnostics retain the exact prefix and useful reason", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [file, message] of [
    [
      "shape.mjs",
      "failures/shape.mjs export source: export source is not a Mokly definition: render must be a function",
    ],
    [
      "link-reference.mjs",
      "failures/link-reference.mjs export source: referenced definition Hidden from failures/link-reference.mjs is not exported by an entry module",
    ],
  ]) {
    const { generation } = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        entryFiles: [`failures/${file}`],
        renderer: null,
        storiesFiles: [],
      }),
    );
    await sidecar.call("cssModules", { generation, classMaps: {} });
    const definitions = await sidecar.call<Definitions>("describe", {
      generation,
    });
    assert.equal(definitions.diagnostics[0]?.message, message);
  }
  const { generation } = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["failures/link-render.tsx"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", { generation, classMaps: {} });
  await installBindings(sidecar, generation);
  await assert.rejects(
    sidecar.call("renderScreen", {
      generation,
      handle: "failures/link-render.tsx#source",
      entry: { path: "source", title: "Source" },
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    }),
    {
      code: "unknown-link-definition",
      message:
        "failures/link-render.tsx export source: referenced definition Hidden from failures/link-render.tsx is not exported by an entry module",
    },
  );
});
