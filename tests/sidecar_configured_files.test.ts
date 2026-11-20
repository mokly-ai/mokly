import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";

import {
  nativeParams,
  nativeRoot,
  write,
} from "./helpers/native_resolution.js";

test("a catch-all paths key cannot redirect generated entries, stories, renderer, or preview", async (context) => {
  const root = await nativeRoot(context);
  await write(path.join(root, "package.json"), "{}");
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"paths":{"*":["./redirected.json"]}}}',
  );
  await write(
    path.join(root, "redirected.json"),
    '{"value":"redirected","version":"1"}',
  );
  await write(path.join(root, "entry.mjs"), "export const value='configured';");
  await write(
    path.join(root, "story.stories.mjs"),
    "export const value='story';",
  );
  await write(path.join(root, "renderer.mjs"), "export default 'renderer';");
  await write(
    path.join(root, ".storybook/preview.mjs"),
    "export default {globals:{proof:'preview'}};",
  );
  const params = nativeParams(root, {
    storiesFiles: ["story.stories.mjs"],
    renderer: "renderer.mjs",
  });
  for (const mode of ["native", "planned", "full"] as const) {
    const result =
      mode === "native"
        ? await bundleWith(params, build, unmeasured, { mode })
        : await bundleWith(
            params,
            build,
            unmeasured,
            mode === "planned" ? { mode, plan: new Map() } : { mode },
          );
    assert.ok("generation" in result, mode);
    const exports = evaluate(result.generation);
    assert.equal(exports.entries["entry.mjs"]!.value, "configured", mode);
    assert.equal(exports.stories["story.stories.mjs"]!.value, "story", mode);
    assert.equal(exports.renderer?.default, "renderer", mode);
    assert.deepEqual(
      exports.preview?.default,
      { globals: { proof: "preview" } },
      mode,
    );
  }
});

test("package extends without authored absolute imports keeps marked edit reuse", async (context) => {
  const root = await nativeRoot(context);
  await write(path.join(root, "package.json"), "{}");
  await write(
    path.join(root, "tsconfig.json"),
    '{"extends":"fixture-config/base.json"}',
  );
  await write(
    path.join(root, "node_modules/fixture-config/base.json"),
    '{"compilerOptions":{"strict":true}}',
  );
  await write(path.join(root, "value.js"), "export const value='relative';");
  for (const aliased of [false, true]) {
    await write(
      path.join(root, "entry.mjs"),
      `export {value} from ${JSON.stringify(aliased ? "fixture" : "./value.js")};`,
    );
    const params = nativeParams(
      root,
      {},
      { aliases: aliased ? { fixture: path.join(root, "value.js") } : {} },
    );
    const first = await bundle(
      params,
      build,
      undefined,
      undefined,
      "serveEdit",
    );
    assert.equal(
      evaluate(first.generation).entries["entry.mjs"]!.value,
      "relative",
    );
    assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
    assert.equal(
      (await reuse([first.generation], params, "serveEdit"))?.runtimeKey,
      first.generation.runtimeKey,
    );
    assert.deepEqual(Object.keys(first.result.compiled.inputDirectories), [
      root,
    ]);
  }
});
