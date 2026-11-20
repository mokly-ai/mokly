import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";
import { ModulePaths } from "../packages/mokly/src/sidecar/module-paths.js";
import { ResolutionEvidence } from "../packages/mokly/src/sidecar/resolution-evidence.js";

import { write } from "./helpers/native_resolution.js";
import { bundleParams } from "./helpers/sidecar.js";

async function exportPackage(
  context: TestContext,
  key: string,
  target: string,
) {
  const temporary = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-export-evidence-"),
  );
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const root = await fs.realpath(temporary);
  const pkg = path.join(root, "node_modules/fixture-package");
  await fs.mkdir(pkg, { recursive: true });
  await fs.writeFile(
    path.join(pkg, "package.json"),
    JSON.stringify({ name: "fixture-package", exports: { [key]: target } }),
  );
  const params = bundleParams({
    sourceRoot: root,
    entryFiles: [],
    renderer: null,
    storiesFiles: [],
    moduleResolution: { ...bundleParams().moduleResolution, packageRoots: [] },
  });
  return { root, pkg, params };
}

async function captureExports(
  context: TestContext,
  key: string,
  target: string,
  name: string,
) {
  const { root, pkg, params } = await exportPackage(context, key, target);
  const evidence = new ResolutionEvidence(
    params,
    await ModulePaths.create(params),
  );
  await evidence.record(`fixture-package/${name}`, root);
  const captured = await evidence.finish({ inputs: {}, outputs: {} });
  assert.equal(captured.complete, true);
  return { pkg, captured };
}

test("export patterns record literal dollar matches in every target star", async (context) => {
  const { pkg, captured } = await captureExports(
    context,
    "./*",
    "./dist/*/*.js",
    "c$&d",
  );
  assert.deepEqual(captured.inputs[path.join(pkg, "dist/c$&d/c$&d.js")], {
    kind: "absent",
  });
});

test("exact export keys preserve literal target stars in evidence", async (context) => {
  const { pkg, captured } = await captureExports(
    context,
    "./x",
    "./dist/a*b.js",
    "x",
  );
  assert.deepEqual(captured.inputs[path.join(pkg, "dist/a*b.js")], {
    kind: "absent",
  });
});

test("export pattern reuse ignores an unrelated directory and rejects a selected target edit", async (context) => {
  const {
    root,
    pkg,
    params: settings,
  } = await exportPackage(context, "./*", "./dist/*/*.js");
  const params = { ...settings, entryFiles: ["entry.mjs"] };
  const selected = path.join(pkg, "dist/c$$d/c$$d.js");
  await write(
    path.join(root, "entry.mjs"),
    "export {value} from 'fixture-package/c$$d';",
  );
  await write(selected, "export const value=1;");
  await write(path.join(pkg, "dist/c$d/retained.js"), "export const unused=1;");
  const first = await bundle(params, build);
  assert.equal(evaluate(first.generation).entries["entry.mjs"]!.value, 1);
  assert.deepEqual(
    first.result.modules.map((module) => module.path),
    ["entry.mjs", "node_modules/fixture-package/dist/c$$d/c$$d.js"],
  );
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    first.generation.runtimeKey,
  );
  await write(path.join(pkg, "dist/c$d/new.js"), "export const unused=2;");
  assert.equal(
    (await reuse([first.generation], params))?.runtimeKey,
    first.generation.runtimeKey,
    "an unrelated export directory must not reject reuse",
  );
  await write(selected, "export const value=2;");
  assert.equal(
    await reuse([first.generation], params),
    undefined,
    "a changed selected export target must reject reuse",
  );
  const current = await bundle(params, build);
  assert.equal(evaluate(current.generation).entries["entry.mjs"]!.value, 2);
});
