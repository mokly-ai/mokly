import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";
import { planKey } from "../packages/mokly/src/sidecar/native-resolution.js";

import { absolutePaths } from "./helpers/absolute_paths.js";
import { countedCompile, write } from "./helpers/native_resolution.js";

for (const mapping of ["exact", "wildcard"] as const)
  test(`in-process reuse observes an earlier absolute ${mapping} paths target`, async (context) => {
    const {
      root,
      params,
      addEarlier: addDefault,
    } = await absolutePaths(context, mapping);
    if (mapping === "wildcard") {
      await write(path.join(root, "one/$&/.keep"), "");
      await write(
        path.join(root, "two/$&/value.js"),
        "export const value='two';",
      );
      await write(
        path.join(root, "entry.mjs"),
        `export {value} from ${JSON.stringify(path.join(root, "$&/value.js"))};`,
      );
    }
    const addEarlier =
      mapping === "wildcard"
        ? () =>
            write(
              path.join(root, "one/$&/value.js"),
              "export const value='one';",
            )
        : addDefault;
    const first = await bundle(params, build);
    assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
    assert.equal(first.result.compiled.reuseEvidence.complete, true);
    const unchanged = await reuse([first.generation], params);
    assert.equal(unchanged?.runtimeKey, first.generation.runtimeKey);
    await addEarlier();
    const fresh = await bundle(params, build);
    assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
    assert.equal(
      (await reuse([first.generation], params))?.runtimeKey,
      undefined,
      "an earlier mapped target must reject in-process reuse",
    );
  });

test("marked edits reject an added earlier absolute paths target", async (context) => {
  const { root, params, addEarlier } = await absolutePaths(context, "wildcard");
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  const counted = countedCompile();
  const planned = await bundle(
    params,
    counted.compile,
    undefined,
    undefined,
    "serveEdit",
    {
      imports: {
        [planKey(
          path.join(root, "entry.mjs"),
          path.join(root, "value.js"),
          "import-statement",
        )]: { path: path.join(root, "two/value.js"), sideEffects: true },
      },
    },
  );
  assert.equal(evaluate(planned.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(counted.counts.compilations, 1);
  assert.equal(counted.consumerResolves(), 0);
  await addEarlier();
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  for (const result of [first, planned]) {
    assert.equal(
      (await reuse([result.generation], params, "serveEdit"))?.runtimeKey,
      undefined,
      "an earlier mapped target must reject marked reuse",
    );
    assert.deepEqual(result.result.compiled.reuseEvidence, {
      complete: false,
      durable: false,
      inputs: {},
    });
  }
});

test("marked edits omit reuse for authored absolute imports under package extends", async (context) => {
  const { root, written, params, addEarlier } = await absolutePaths(context);
  await write(
    path.join(root, "node_modules/fixture-config/base.json"),
    JSON.stringify({
      compilerOptions: {
        paths: { [written]: ["./../../one/value.js", "./../../two/value.js"] },
      },
    }),
  );
  await write(
    path.join(root, "tsconfig.json"),
    '{"extends":"fixture-config/base.json"}',
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  await addEarlier();
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, undefined);
});

test("absolute configDir paths capture rejects an added earlier target", async (context) => {
  const { root, written, params, addEarlier } = await absolutePaths(context);
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: { [written]: ["${configDir}/one/value.js", "./two/value.js"] },
      },
    }),
  );
  const first = await bundle(params, build);
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await addEarlier();
  const fresh = await bundle(params, build);
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(await reuse([first.generation], params), undefined);
});

test("exact paths keys preserve literal target stars", async (context) => {
  for (const absolute of [true, false]) {
    const { root, written, params, addEarlier } = await absolutePaths(context);
    const name = absolute ? written : "@/value";
    await write(
      path.join(root, "entry.mjs"),
      `export {value} from ${JSON.stringify(name)};`,
    );
    await write(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          paths: { [name]: ["./one/*/value.js", "./two/value.js"] },
        },
      }),
    );
    const first = await bundle(params, build);
    assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
    assert.equal(first.result.compiled.reuseEvidence.complete, true);
    assert.deepEqual(
      first.result.compiled.reuseEvidence.inputs[path.join(root, "one/*")],
      { kind: "absent" },
    );
    await addEarlier();
    assert.equal(
      (await reuse([first.generation], params))?.runtimeKey,
      first.generation.runtimeKey,
    );
  }
});

test("relative two-target mappings and unmatched absolute imports keep reuse", async (context) => {
  for (const relative of [true, false]) {
    const { root, params, addEarlier } = await absolutePaths(context);
    await write(
      path.join(root, "entry.mjs"),
      `export {value} from ${JSON.stringify(relative ? "@/value.js" : path.join(root, "two/value.js"))};`,
    );
    if (relative)
      await write(
        path.join(root, "tsconfig.json"),
        '{"compilerOptions":{"paths":{"@/*":["./one/*","./two/*"]}}}',
      );
    const full = await bundle(params, build);
    const edit = await bundle(params, build, undefined, undefined, "serveEdit");
    assert.equal(evaluate(full.generation).entries["entry.mjs"]!.value, "two");
    assert.equal(full.result.compiled.reuseEvidence.complete, true);
    assert.equal(edit.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.equal(
      (await reuse([full.generation], params))?.runtimeKey,
      full.generation.runtimeKey,
    );
    assert.equal(
      (await reuse([edit.generation], params, "serveEdit"))?.runtimeKey,
      edit.generation.runtimeKey,
    );
    await addEarlier();
    assert.equal(
      (await reuse([full.generation], params))?.runtimeKey,
      relative ? undefined : full.generation.runtimeKey,
    );
  }
});

test("symlinked configs anchor absolute mapping targets in their real directory", async (context) => {
  const { root, written, params } = await absolutePaths(context);
  await write(path.join(root, "shared/one/.keep"), "");
  await write(
    path.join(root, "shared/two/value.js"),
    "export const value='two';",
  );
  await write(
    path.join(root, "shared/tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        paths: { [written]: ["./one/value.js", "./two/value.js"] },
      },
    }),
  );
  await fs.unlink(path.join(root, "tsconfig.json"));
  await fs.symlink("shared/tsconfig.json", path.join(root, "tsconfig.json"));
  const first = await bundle(params, build);
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(
    path.join(root, "shared/one/value.js"),
    "export const value='one';",
  );
  const fresh = await bundle(params, build);
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    undefined,
    "an earlier target beside the real config must reject captured reuse",
  );
});
