import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";

import { matureMetadata } from "./helpers/mature_metadata.js";
import {
  countedCompile,
  editFingerprint,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

async function nativePlan(params: BundleParams): Promise<ResolutionPlan> {
  const native = await bundleWith(params, build, unmeasured, {
    mode: "native",
  });
  assert.ok(!("generation" in native) && native.plan);
  return native.plan;
}

async function outcome(run: () => Promise<{ result: unknown }>) {
  try {
    return { result: (await run()).result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const screen = (imports: Array<[string, string]>, label: string) =>
  [
    ...imports.map(
      ([name, file]) => `import { ${name} } from "./${file}.mjs";`,
    ),
    'import { tool } from "./vendor/node_modules/tool/tool.mjs";',
    `export const label = [tool(${JSON.stringify(label)}), ${imports.map(([name]) => name).join(", ")}];`,
  ].join("\n");

test("a guarded edit compile gives the outcome of the same edit without a plan", async (context) => {
  matureMetadata(context);
  const root = await nativeRoot(context);
  const chain = path.join(root, "node_modules/chain");
  await packageAt(chain, "chain", 'export { value } from "./part.mjs";');
  await write(path.join(chain, "part.mjs"), "export const value = 1;");
  await write(
    path.join(root, "vendor/node_modules/tool/tool.mjs"),
    "export const tool = (text) => text;",
  );
  await write(path.join(root, "helper.mjs"), "export const helper = 1;");
  await write(path.join(root, "renamed.mjs"), "export const renamed = 1;");
  await write(path.join(root, "extra.mjs"), "export const extra = 1;");
  const file = path.join(root, "screen.mjs");
  await write(
    file,
    screen(
      [
        ["helper", "helper"],
        ["renamed", "renamed"],
      ],
      "title",
    ),
  );
  await write(
    path.join(root, "entry.mjs"),
    'export { value } from "chain";\nexport { label } from "./screen.mjs";',
  );
  const config = path.join(root, "tsconfig.json");
  await write(config, '{"compilerOptions":{"strict":true}}');
  const params = nativeParams(root);
  let plan = await nativePlan(params);
  const steps: Array<[string, () => Promise<void>, boolean]> = [
    [
      "an edit inside one module",
      () =>
        write(
          file,
          screen(
            [
              ["helper", "helper"],
              ["renamed", "renamed"],
            ],
            "edited",
          ),
        ),
      false,
    ],
    [
      "a new import",
      () =>
        write(
          file,
          screen(
            [
              ["helper", "helper"],
              ["renamed", "renamed"],
              ["extra", "extra"],
            ],
            "edited",
          ),
        ),
      false,
    ],
    [
      "a removed import",
      () =>
        write(
          file,
          screen(
            [
              ["renamed", "renamed"],
              ["extra", "extra"],
            ],
            "edited",
          ),
        ),
      false,
    ],
    [
      "a renamed file",
      async () => {
        await fs.rename(
          path.join(root, "renamed.mjs"),
          path.join(root, "moved.mjs"),
        );
        await write(
          file,
          screen(
            [
              ["renamed", "moved"],
              ["extra", "extra"],
            ],
            "edited",
          ),
        );
      },
      true,
    ],
    ["a failed compile", () => write(file, "export const label = ;"), false],
    [
      "its recovery",
      () =>
        write(
          file,
          screen(
            [
              ["renamed", "moved"],
              ["extra", "extra"],
            ],
            "recovered",
          ),
        ),
      false,
    ],
    [
      "an edit of a configuration file",
      () => write(config, '{"compilerOptions":{"strict":false}}'),
      true,
    ],
  ];
  for (const [name, change, recapture] of steps) {
    await change();
    if (recapture) plan = await nativePlan(params);
    const counted = countedCompile();
    const guarded = await outcome(() =>
      bundle(params, counted.compile, undefined, undefined, "serveEdit", plan),
    );
    const plain = await outcome(() =>
      bundle(params, build, undefined, undefined, "serveEdit"),
    );
    if ("error" in guarded || "error" in plain) {
      assert.deepEqual(guarded, plain, name);
      continue;
    }
    assert.deepEqual(
      editFingerprint(guarded.result as never),
      editFingerprint(plain.result as never),
      name,
    );
    assert.equal(
      counted.counts.compilations,
      1,
      `${name} keeps its guarded result`,
    );
  }
});
