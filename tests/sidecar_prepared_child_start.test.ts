import assert from "node:assert/strict";
import test from "node:test";
import type { TestContext } from "node:test";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import { cssParams, startSidecar } from "./helpers/sidecar.js";
import { editSource } from "./helpers/sidecar_edit.js";

const preparation = { context: "attempt", postcss: "postcss.mjs" };

async function preparedSource(context: TestContext) {
  const source = await editSource(context);
  await source.write("postcss.mjs", "export default {plugins:[]};");
  await source.write("theme.css", ".theme{color:red}");
  const sidecar = startSidecar(context, source.root);
  await sidecar.call("hello");
  return { params: source.params, sidecar };
}

function childStarts(sidecar: ReturnType<typeof startSidecar>) {
  return sidecar.operations.filter(
    ({ operation }) => operation === "postcss-start",
  ).length;
}

async function bundleThenStylesheet(
  sidecar: ReturnType<typeof startSidecar>,
  params: BundleParams,
) {
  const bundled = await sidecar.call("bundle", { ...params, preparation });
  assert.ok(bundled && typeof bundled === "object" && "generation" in bundled);
  assert.equal(childStarts(sidecar), 0);
  const css = await sidecar.call<CssResult>(
    "processCss",
    cssParams({
      context: preparation.context,
      sourceRoot: params.sourceRoot,
      moduleResolution: params.moduleResolution,
      sourcePath: "theme.css",
      text: ".theme{color:red}",
    }),
  );
  assert.match(css.text, /\.theme/);
  assert.equal(childStarts(sidecar), 1);
}

test("After a failed prepareContext, a prepared bundle starts no PostCSS child, and the first processCss starts it", async (context) => {
  const { params, sidecar } = await preparedSource(context);
  await assert.rejects(sidecar.call("prepareContext", null as never));
  await bundleThenStylesheet(sidecar, params);
  await sidecar.call("shutdown");
});
