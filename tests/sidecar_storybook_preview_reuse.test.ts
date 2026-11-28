import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { ViteCompiler } from "../packages/mokly/src/sidecar/vite-compiler.js";

import { nativeRoot } from "./helpers/native_resolution.js";
import { bundleParams } from "./helpers/sidecar.js";

async function project(context: TestContext, vite: boolean) {
  const root = await fs.realpath(await nativeRoot(context));
  const story = "story.stories.tsx";
  const preview = path.join(root, ".storybook/preview.ts");
  await fs.mkdir(path.dirname(preview));
  await fs.writeFile(path.join(root, story), "export const Example = {};");
  if (vite)
    await fs.symlink(
      path.resolve("node_modules"),
      path.join(root, "node_modules"),
      "junction",
    );
  return {
    root,
    preview,
    params: bundleParams({
      ...(vite && { vite }),
      sourceRoot: root,
      entryFiles: [],
      storiesFiles: [story],
      renderer: null,
    }),
  };
}

for (const adapter of ["esbuild", "Vite"]) {
  test(`${adapter} Serve edit rejects a higher preview that appeared during compilation`, async (context) => {
    const { root, preview, params } = await project(
      context,
      adapter === "Vite",
    );
    const later = ".storybook/preview.ts";
    const earlier = ".storybook/preview.js";
    const next = "export default { initialGlobals: { location: 'new' } };";
    await fs.writeFile(preview, "export default {};");
    const capturing: typeof build = async (options) => {
      const result = await build(options);
      await fs.writeFile(path.join(root, earlier), next);
      return result;
    };
    const vite = new ViteCompiler(() => {});
    context.after(() => vite.dispose());
    if (params.vite) {
      await fs.writeFile(
        path.join(root, "vite.config.mjs"),
        `
        import { writeFileSync } from "node:fs";
        export default { plugins: [{ name: "add-preview", transform(_code, id) {
          if (id === ${JSON.stringify(preview)}) writeFileSync(${JSON.stringify(path.join(root, earlier))}, ${JSON.stringify(next)});
        } }] };
      `,
      );
    }
    const result = params.vite
      ? await vite.bundle(params, build, "serveEdit")
      : await bundle(params, capturing, undefined, undefined, "serveEdit");
    assert.equal(await fs.readFile(path.join(root, earlier), "utf8"), next);
    assert.deepEqual(
      result.result.modules.map(({ path }) => path),
      [later, "story.stories.tsx"],
    );
    assert.equal(result.result.compiled.metadataInputs[earlier], null);
    assert.equal(
      (await reuse([result.generation], params, "serveEdit"))?.id,
      undefined,
    );
  });

  test(`${adapter} Serve edit rejects a preview link retargeted to identical bytes`, async (context) => {
    const { root, preview, params } = await project(
      context,
      adapter === "Vite",
    );
    const vite = new ViteCompiler(() => {});
    context.after(() => vite.dispose());
    for (const [folder, value] of [
      ["first", "old"],
      ["second", "new"],
    ] as const) {
      await fs.mkdir(path.join(root, folder));
      await fs.writeFile(
        path.join(root, folder, "preview.ts"),
        'import place from "./place.js"; export default { initialGlobals: { place } };',
      );
      await fs.writeFile(
        path.join(root, folder, "place.js"),
        `export default '${value}';`,
      );
    }
    await fs.symlink(path.join(root, "first/preview.ts"), preview);
    const previous = params.vite
      ? await vite.bundle(params, build, "serveEdit")
      : await bundle(params, build, undefined, undefined, "serveEdit");
    assert.equal(
      (await reuse([previous.generation], params, "serveEdit"))?.id,
      previous.generation.id,
    );
    await fs.unlink(preview);
    await fs.symlink(path.join(root, "second/preview.ts"), preview);
    assert.equal(
      (await reuse([previous.generation], params, "serveEdit"))?.id,
      undefined,
    );
    assert.deepEqual(
      previous.result.compiled.storybookPreviews?.[".storybook"]?.selected,
      {
        path: ".storybook/preview.ts",
        file: "first/preview.ts",
      },
    );
    assert.deepEqual(previous.result.compiled.reuseEvidence.inputs[preview], {
      kind: "link",
      target: path.join(root, "first/preview.ts"),
    });
  });
}
