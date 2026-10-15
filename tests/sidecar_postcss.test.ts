import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import {
  bundleParams,
  sidecarFixture,
  startSidecar,
} from "./helpers/sidecar.js";

test("PostCSS factories run once, helpers keep locations, and new bundles reset the worker", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const first = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["page.mockup.ts"],
      storiesFiles: [],
      renderer: null,
    }),
  );
  const process = () =>
    sidecar.call<CssResult>("processCss", {
      postcss: "postcss-types.mts",
      sourcePath: "input.css",
      text: ".a {}",
    });
  const one = await process();
  assert.match(one.text, /order: 1/);
  assert.ok(one.text.includes(path.join(sidecarFixture, "postcss-types.mts")));
  assert.ok(one.text.includes(path.join(sidecarFixture, "postcss-helper.cts")));
  assert.ok(
    one.dependencies.some((dependency) =>
      dependency.path.endsWith("postcss-helper.cts"),
    ),
  );
  assert.match((await process()).text, /order: 2/);
  const second = await sidecar.call<BundleResult>(
    "bundle",
    bundleParams({
      entryFiles: ["definition-links.mjs"],
      storiesFiles: [],
      renderer: null,
    }),
  );
  assert.notEqual(first.generation, second.generation);
  assert.match((await process()).text, /order: 1/);
  const native = await sidecar.call<CssResult>("processCss", {
    postcss: "postcss-context.mts",
    sourcePath: "input.css",
    text: ".a {}",
  });
  assert.ok(
    native.text.includes(path.join(sidecarFixture, "postcss-local/child.cjs")),
  );
  assert.ok(
    native.dependencies.some((dependency) =>
      dependency.path.endsWith("postcss-local/child.cjs"),
    ),
  );
  await sidecar.call("shutdown");
});
