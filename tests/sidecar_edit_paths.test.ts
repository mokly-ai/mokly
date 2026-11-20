import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import { configDirPaths } from "./helpers/config_dir.js";
import { packageAt, write } from "./helpers/native_resolution.js";

async function expoPaths(
  root: string,
  localPaths?: Record<string, string[]>,
): Promise<void> {
  await write(
    path.join(root, "node_modules/expo/tsconfig.base.json"),
    '{"compilerOptions":{"strict":true,"paths":{"@/*":["../../one/*","../../two/*"]}}}',
  );
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      extends: "expo/tsconfig.base",
      ...(localPaths ? { compilerOptions: { paths: localPaths } } : {}),
    }),
  );
}

test("marked edits reject an added earlier ordinary bare paths target", async (context) => {
  const { root, params, addEarlier } = await configDirPaths(context);
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"@/*":["./one/*","./two/*"]}}}',
  );
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
    "two-target bare mappings must reject marked reuse",
  );
});

test("a single-target bare paths mapping keeps marked edit reuse", async (context) => {
  const { root, params, addEarlier } = await configDirPaths(context);
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"@/*":["./one/*","./two/*"],"@/value.js":["./two/value.js"]}}}',
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  await addEarlier();
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
});

test("Expo package extends with local single-target paths keeps marked edit reuse", async (context) => {
  const { root, params, addEarlier } = await configDirPaths(context);
  await expoPaths(root, { "@/*": ["./two/*"] });
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  await addEarlier();
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
});

test("package-supplied paths keep marked edit reuse while unchanged", async (context) => {
  const { root, params } = await configDirPaths(context);
  await expoPaths(root);
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
});

test("marked edits reject a mapped file added after single-target package fallback", async (context) => {
  const { root, params } = await configDirPaths(context);
  await packageAt(
    path.join(root, "node_modules/fixture-package"),
    "fixture-package",
    "export const value='installed';",
  );
  await write(
    path.join(root, "entry.mjs"),
    "export {value} from 'fixture-package';",
  );
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"fixture-package":["./one/package.js"]}}}',
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(first.generation).entries["entry.mjs"]!.value,
    "installed",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(
    path.join(root, "one/package.js"),
    "export const value='mapped';",
  );
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(fresh.generation).entries["entry.mjs"]!.value,
    "mapped",
  );
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an added single mapped target must reject stale package fallback",
  );
});

test("marked edits reject a file that shadows a mapped barrel", async (context) => {
  const { root, params } = await configDirPaths(context);
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"@/*":["./src/*"]}}}',
  );
  await write(
    path.join(root, "entry.mjs"),
    "export {value} from '@/components';",
  );
  await write(
    path.join(root, "src/components/index.ts"),
    "export const value='barrel';",
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(first.generation).entries["entry.mjs"]!.value,
    "barrel",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(
    path.join(root, "src/components.ts"),
    "export const value='file';",
  );
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "file");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "a file that shadows a mapped barrel must reject marked reuse",
  );
});

test("marked edits reject an index added to an earlier mapped target directory", async (context) => {
  const { root, params } = await configDirPaths(context);
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"@/*":["./one/*","./two/*"]}}}',
  );
  await write(path.join(root, "entry.mjs"), "export {value} from '@/value';");
  await write(path.join(root, "one/value/.keep"), "");
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, "two");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(
    path.join(root, "one/value/index.js"),
    "export const value='one';",
  );
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an index in an earlier target directory must reject marked reuse",
  );
});

test("marked edits reject a baseUrl file added before package fallback", async (context) => {
  const { root, params } = await configDirPaths(context);
  await packageAt(
    path.join(root, "node_modules/fixture-package"),
    "fixture-package",
    "export const value='installed';",
  );
  await write(
    path.join(root, "entry.mjs"),
    "export {value} from 'fixture-package';",
  );
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"baseUrl":"./one"}}',
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(first.generation).entries["entry.mjs"]!.value,
    "installed",
  );
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(
    path.join(root, "one/fixture-package.js"),
    "export const value='baseUrl';",
  );
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(fresh.generation).entries["entry.mjs"]!.value,
    "baseUrl",
  );
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "a baseUrl candidate must reject stale package fallback",
  );
});

test("marked edits reject earlier absolute targets reached through a bare alias", async (context) => {
  const { root, params, addEarlier } = await configDirPaths(context);
  const written = path.join(root, "written.js");
  params.moduleResolution.aliases = { fixture: written };
  await write(written, "export const value='written';");
  await write(path.join(root, "entry.mjs"), "export {value} from 'fixture';");
  await write(
    path.join(root, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: { paths: { [written]: ["./one/value.js"] } },
    }),
  );
  const first = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(
    evaluate(first.generation).entries["entry.mjs"]!.value,
    "written",
  );
  const unchanged = await reuse([first.generation], params, "serveEdit");
  await addEarlier();
  const fresh = await bundle(params, build, undefined, undefined, "serveEdit");
  assert.equal(evaluate(fresh.generation).entries["entry.mjs"]!.value, "one");
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  assert.equal(unchanged?.runtimeKey, first.generation.runtimeKey);
  assert.equal(
    (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
    undefined,
    "an earlier absolute mapping after a bare alias must reject marked reuse",
  );
});
