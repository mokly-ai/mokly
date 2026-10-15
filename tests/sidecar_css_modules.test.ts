import assert from "node:assert/strict";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { RenderResult } from "../packages/mokly/src/generated/sidecar/RenderResult.js";

import {
  bundleParams,
  installBindings,
  startSidecar,
} from "./helpers/sidecar.js";

test("CSS module maps expose Unicode and namespace-shaped names without CJS interop", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundle = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["module-exports.mockup.tsx"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await sidecar.call("cssModules", {
    generation: bundle.generation,
    classMaps: {
      "exports.module.css": {
        __esModule: "scoped-module",
        constructor: "scoped-constructor",
        café: "scoped-cafe",
      },
    },
  });
  await installBindings(sidecar, bundle.generation);
  const result = await sidecar.call<RenderResult>("renderScreen", {
    generation: bundle.generation,
    handle: "module-exports.mockup.tsx#default",
    entry: { path: "modules", title: "Modules" },
    props: {},
    viewport: "mobile",
    colorScheme: "light",
  });
  assert.equal(
    result.html,
    '<main class="scoped-module scoped-module scoped-constructor scoped-cafe">Maps</main>',
  );
  await sidecar.call("shutdown");
});

test("failed class-map installation leaves the generation unevaluated", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const bundled = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["module-exports.mockup.tsx"],
      renderer: null,
      storiesFiles: [],
    }),
  );
  await assert.rejects(
    sidecar.call("cssModules", {
      generation: bundled.generation,
      classMaps: { "exports.module.css": {} },
    }),
    { code: "bundle-failed" },
  );
  await assert.rejects(
    sidecar.call("describe", { generation: bundled.generation }),
    /cssModules/,
  );
  await sidecar.call("shutdown");
});
