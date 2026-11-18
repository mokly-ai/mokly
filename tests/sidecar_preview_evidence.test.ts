import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { entryModule } from "../packages/mokly/src/sidecar/bundle-entry.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { ResolutionEvidence } from "../packages/mokly/src/sidecar/resolution-evidence.js";

import { bundleParams } from "./helpers/sidecar.js";

async function source(context: TestContext) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-large-preview-"),
  );
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = await fs.realpath(directory);
  await fs.mkdir(path.join(root, ".storybook"));
  const preview = path.join(root, ".storybook/preview.ts");
  await fs.writeFile(
    path.join(root, "story.stories.tsx"),
    "export const Example={};",
  );
  return {
    root,
    preview,
    params: bundleParams({
      sourceRoot: root,
      entryFiles: [],
      storiesFiles: ["story.stories.tsx"],
      renderer: null,
    }),
  };
}

test("large Storybook previews keep complete evidence and check consumed content", async (context) => {
  const { root, preview, params } = await source(context);
  const text =
    "export default {globals:{proof:'original'}};\n" + " ".repeat(1024 * 1024);
  await fs.writeFile(preview, text);
  const first = await bundle(params, build);
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  const unchanged = await reuse([first.generation], params);
  assert.equal(unchanged?.runtimeKey, first.generation.runtimeKey);
  await fs.writeFile(preview, text.replace("original", "changed"));
  assert.equal(await reuse([first.generation], params), undefined);
  const extension = path.join(root, "settings.json");
  await fs.writeFile(extension, "{}");
  await fs.writeFile(
    path.join(root, "tsconfig.json"),
    JSON.stringify({ extends: extension }),
  );
  const incomplete = await bundle(params, build);
  assert.equal(incomplete.result.compiled.reuseEvidence.complete, false);
  assert.deepEqual(
    incomplete.result.modules.map((module) => module.path),
    [".storybook/preview.ts", "story.stories.tsx"],
  );
});

test("preview selection uses the captured observation across a temporary deletion", async (context) => {
  const { root, preview, params } = await source(context);
  const text = "export default {globals:{proof:'captured'}};";
  await fs.writeFile(preview, text);
  const retained = path.join(root, "retained-preview.ts");
  const prepare = ResolutionEvidence.prototype.prepare;
  context.mock.method(
    ResolutionEvidence.prototype,
    "prepare",
    async function (this: ResolutionEvidence) {
      const selected = await prepare.call(this);
      await fs.rename(preview, retained);
      return selected;
    },
  );
  const compile: typeof build = async (options) => {
    await fs.rename(retained, preview);
    return build(options);
  };
  const first = await bundle(params, compile);
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  assert.deepEqual(
    first.result.modules.map((module) => module.path),
    [".storybook/preview.ts", "story.stories.tsx"],
  );
  assert.equal(await fs.readFile(preview, "utf8"), text);
  const unchanged = await reuse([first.generation], params);
  assert.equal(unchanged?.runtimeKey, first.generation.runtimeKey);
});

test("a preview edit during compilation cannot replace its consumed digest", async (context) => {
  const { preview, params } = await source(context);
  await fs.writeFile(preview, "export default {globals:{proof:'old'}};");
  const compile: typeof build = async (options) => {
    const result = await build(options);
    await fs.writeFile(preview, "export default {globals:{proof:'new'}};");
    return result;
  };
  const captured = await bundle(params, compile);
  assert.equal(await reuse([captured.generation], params), undefined);
});

test("an imported manifest restored during compilation keeps its consumed digest", async (context) => {
  const { root, preview, params } = await source(context);
  const manifest = path.join(root, "package.json");
  const original = '{"name":"original"}';
  await fs.writeFile(manifest, original);
  await fs.writeFile(
    preview,
    "import manifest from '../package.json';export default {globals:{proof:manifest.name}};",
  );
  const compile: typeof build = async (options) => {
    await fs.writeFile(manifest, '{"name":"during"}');
    const result = await build(options);
    await fs.writeFile(manifest, original);
    return result;
  };
  const captured = await bundle(params, compile);
  assert.equal(captured.result.compiled.reuseEvidence.complete, true);
  assert.match(captured.result.compiled.code, /during/);
  assert.equal(await reuse([captured.generation], params), undefined);
});

test("uncaptured Storybook discovery selects a regular preview file", async (context) => {
  const { root, preview, params } = await source(context);
  await fs.mkdir(path.join(root, ".storybook/preview.tsx"));
  await fs.writeFile(preview, "export default {};");
  const entry = await entryModule(params, undefined, "serveEdit");
  assert.equal(entry.preview, ".storybook/preview.ts");
  assert.match(entry.contents, /preview\.ts"; export \{ preview \}/);
});

test("uncaptured Storybook selection survives a failed native compile", async (context) => {
  const { root, preview, params } = await source(context);
  await fs.writeFile(preview, "export default {};");
  const retained = path.join(root, "retained-preview.ts");
  const entries: Array<string | undefined> = [];
  let attempts = 0;
  const compile: typeof build = async (options) => {
    attempts++;
    const contents = options.stdin?.contents;
    assert.ok(typeof contents === "string");
    entries.push(contents);
    if (attempts === 1) {
      await fs.rename(preview, retained);
      throw new Error("native compile fixture");
    }
    await fs.rename(retained, preview);
    return build(options);
  };
  const compiled = await bundle(
    params,
    compile,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.equal(attempts, 2);
  assert.ok(
    entries.every((entry) =>
      entry?.includes('preview.ts"; export { preview }'),
    ),
  );
  assert.deepEqual(
    compiled.result.modules.map((module) => module.path),
    [".storybook/preview.ts", "story.stories.tsx"],
  );
  assert.equal(compiled.result.compiled.reuseEvidence.uncaptured, "serveEdit");
});
