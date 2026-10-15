import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";

import { bundleParams, startSidecar } from "./helpers/sidecar.js";

test("describe preserves authoring diagnostic codes without closing transport", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [file, expected] of [
    ["array", ["array-export", "empty-module"]],
    ["empty", ["empty-module"]],
    ["copied", ["invalid-definition", "empty-module"]],
    [
      "fields",
      ["invalid-field", "invalid-folder", "invalid-variants", "invalid-field"],
    ],
  ] as const) {
    const bundle = await sidecar.call<BundleResult>(
      "bundle",
      bundleParams({
        entryFiles: [`failures/${file}.mjs`],
        storiesFiles: [],
        renderer: null,
      }),
    );
    await sidecar.call("cssModules", {
      generation: bundle.generation,
      classMaps: {},
    });
    const result = await sidecar.call<Definitions>("describe", {
      generation: bundle.generation,
    });
    assert.deepEqual(
      result.diagnostics.map((item) => item.code).sort(),
      [...expected].sort(),
    );
    assert.ok(
      result.diagnostics.every(
        (item) => item.module === `failures/${file}.mjs`,
      ),
    );
    await sidecar.call("dispose", { generation: bundle.generation });
  }
  await sidecar.call("shutdown");
});

test("bundle and evaluation failures remain reusable and route logs to stderr", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call(
      "bundle",
      bundleParams({
        entryFiles: ["missing.ts"],
        renderer: null,
        storiesFiles: [],
      }),
    ),
    { code: "bundle-failed" },
  );
  const bundle = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["failures/evaluation.mjs"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: {},
  });
  await assert.rejects(
    sidecar.call("describe", { generation: bundle.generation }),
    /fixture evaluation failed/,
  );
  await sidecar.call("dispose", { generation: bundle.generation });
  assert.match(sidecar.stderr(), /consumer evaluation diagnostic/);
  await sidecar.call("shutdown");
});

test("throws, promises, invalid nodes and forged markers fail each render", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundle = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["failures/renders.mjs"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: {},
  });
  for (const name of ["thrown", "promise", "value", "forged"]) {
    await assert.rejects(
      sidecar.call("renderPage", {
        generation: bundle.generation,
        handle: `failures/renders.mjs#${name}`,
      }),
      { code: "render-failed" },
    );
  }
  await assert.rejects(
    sidecar.call("renderScreen", {
      generation: bundle.generation,
      handle: "failures/renders.mjs#node",
      props: {},
      viewport: "mobile",
      colorScheme: "light",
    }),
    { code: "render-failed" },
  );
  await sidecar.call("shutdown");
});

test("unknown methods and missing hello fail closed", async (context) => {
  for (const method of ["unknown", "shutdown"]) {
    const sidecar = startSidecar(context);
    await assert.rejects(sidecar.call(method), { code: "sidecar-protocol" });
    await new Promise<void>((resolve) =>
      sidecar.child.once("exit", () => resolve()),
    );
    assert.equal(sidecar.child.exitCode, 1);
  }
});

test("declared non-data props report their property path", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundled = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["failures/props.mjs"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundled.generation,
    classMaps: {},
  });
  const definitions = await sidecar.call<Definitions>("describe", {
    generation: bundled.generation,
  });
  assert.equal(definitions.diagnostics[0]?.code, "component-props");
  assert.match(definitions.diagnostics[0]!.message, /\/label/);
  await sidecar.call("shutdown");
});
