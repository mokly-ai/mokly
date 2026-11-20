import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { write } from "./helpers/native_resolution.js";
import { pnpFolder } from "./helpers/pnp_folder.js";

test("PnP folder discovery and verification share the aggregate metadata allowance", async (context) => {
  const fixture = await pnpFolder(context, "json");
  const pkg = path.join(fixture.root, ".yarn/chosen");
  const targets = ["one", "two", "three", "four", "five"];
  await write(
    path.join(pkg, "package.json"),
    JSON.stringify({
      name: "chosen",
      exports: { "./sub/": targets.map((name) => `./${name}/`) },
    }),
  );
  for (const name of targets) {
    await write(
      path.join(pkg, name, "value/package.json"),
      JSON.stringify({ main: "./index.js", padding: "x".repeat(900_000) }),
    );
    await write(
      path.join(pkg, name, "value/index.js"),
      'export const value="original-index";',
    );
  }
  const full = await bundle(fixture.params, build);
  assert.match(full.result.compiled.code, /original-index/);
  assert.equal(full.result.compiled.reuseEvidence.complete, false);
  assert.equal(
    (await reuse([full.generation], fixture.params))?.runtimeKey,
    undefined,
  );
  const edit = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(edit.result.compiled.code, /original-index/);
  assert.equal(edit.result.compiled.reuseEvidence.uncaptured, undefined);
  assert.equal(
    (await reuse([edit.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});
