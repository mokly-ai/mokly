import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { CssResult } from "../packages/mokly/src/generated/sidecar/CssResult.js";

import {
  bundleParams,
  cssParams,
  sidecarFixture,
  startSidecar,
} from "./helpers/sidecar.js";
import { sidecarSources } from "./helpers/sidecar_sources.js";

test("PostCSS factories run once per explicit context and keep helper locations", async (context) => {
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
      ...cssParams(),
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
  assert.match((await process()).text, /order: 3/);
  await sidecar.call("disposeContext", { context: "css" });
  assert.match((await process()).text, /order: 1/);
  const native = await sidecar.call<CssResult>("processCss", {
    ...cssParams(),
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

test("CSS-only contexts reuse their own workers and dispose independently", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  const process = (context: string) =>
    sidecar.call<CssResult>(
      "processCss",
      cssParams({ context, text: ".a {}" }),
    );
  assert.match((await process("head")).text, /order: 1/);
  assert.match((await process("base")).text, /order: 1/);
  await sidecar.call("disposeContext", { context: "base" });
  assert.match((await process("head")).text, /order: 2/);
  assert.match((await process("base")).text, /order: 1/);
  await assert.rejects(
    sidecar.call(
      "processCss",
      cssParams({
        context: "head",
        moduleResolution: {
          ...bundleParams().moduleResolution,
          aliases: { missing: "other" },
        },
      }),
    ),
    /changed its sources or resolution/,
  );
});

test("throwing PostCSS plugins keep the module and bundle failure code", async (context) => {
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  await assert.rejects(
    sidecar.call("processCss", cssParams({ postcss: "failures/postcss.mjs" })),
    {
      code: "bundle-failed",
      message: /failures\/postcss.mjs.*fixture plugin failed/,
    },
  );
});

test("logical dependency stylesheets resolve against their selected physical roots", async (context) => {
  const { root, base } = await sidecarSources(context);
  const dependencies = [
    path.join(root, "one/node_modules"),
    path.join(root, "two/node_modules"),
  ];
  for (const directory of dependencies)
    await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(base, "postcss.mjs"),
    `export default {plugins:[{postcssPlugin:'source',Once(root,{result}){root.append({selector:'.source',nodes:[{prop:'from',value:JSON.stringify(result.opts.from)}]})}}]};`,
  );
  const sidecar = startSidecar(context);
  await sidecar.call("hello");
  for (const [index, sourcePath] of [
    "node_modules/theme/input.css",
    "node_modules/.mokly-roots/1/theme/input.css",
  ].entries()) {
    const result = await sidecar.call<CssResult>(
      "processCss",
      cssParams({
        sourceRoot: base,
        repositoryRoots: [],
        postcss: "postcss.mjs",
        sourcePath,
        moduleResolution: {
          ...bundleParams().moduleResolution,
          packageRoots: dependencies,
        },
      }),
    );
    assert.ok(
      result.text.includes(
        JSON.stringify(path.join(dependencies[index]!, "theme/input.css")),
      ),
      result.text,
    );
  }
});
