import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import { configDirPaths } from "./helpers/config_dir.js";
import { write } from "./helpers/native_resolution.js";

test("in-process reuse rejects an added earlier configDir paths target", async (context) => {
  const { params, addEarlier } = await configDirPaths(context);
  const first = await bundle(params, build);
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await addEarlier();
  const fresh = await bundle(params, build);
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    undefined,
    "an earlier interpolated target must reject in-process reuse",
  );
});

test("marked Serve edits reject an added earlier configDir paths target", async (context) => {
  const { params, addEarlier } = await configDirPaths(context);
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await addEarlier();
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an earlier interpolated target must reject marked reuse",
  );
});

for (const inherited of [
  {
    name: "paths targets",
    options: {
      paths: { "@/*": ["${configDir}/one/*", "${configDir}/two/*"] },
    },
  },
  {
    name: "baseUrl",
    options: {
      baseUrl: "${configDir}",
      paths: { "@/*": ["./one/*", "./two/*"] },
    },
  },
])
  test(`inherited configDir ${inherited.name} use the top-level directory and invalidate earlier additions`, async (context) => {
    const { root, params, addEarlier } = await configDirPaths(context);
    await write(
      path.join(root, "config/base.json"),
      JSON.stringify({ compilerOptions: inherited.options }),
    );
    await write(
      path.join(root, "tsconfig.json"),
      '{"extends":"./config/base.json"}',
    );
    const first = await bundle(params, build);
    assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
    assert.equal(
      (await reuse([first.generation], params))?.runtimeKey,
      first.generation.runtimeKey,
      "known inherited interpolation must retain exact captured reuse",
    );
    await addEarlier();
    const fresh = await bundle(params, build);
    assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
    assert.equal(
      (await reuse([first.generation], params))?.runtimeKey,
      undefined,
      "inherited interpolation must reject reuse after an earlier target appears",
    );
  });
