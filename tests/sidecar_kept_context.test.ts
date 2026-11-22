import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleParams } from "../packages/mokly/src/generated/sidecar/BundleParams.js";
import type { ResolutionPlan } from "../packages/mokly/src/generated/sidecar/ResolutionPlan.js";
import { bundle, bundleWith } from "../packages/mokly/src/sidecar/bundle.js";
import type { Bundled } from "../packages/mokly/src/sidecar/bundle.js";
import { unmeasured } from "../packages/mokly/src/sidecar/measurements.js";

import { countedKept, differingFields } from "./helpers/kept_context.js";
import { matureMetadata } from "./helpers/mature_metadata.js";
import {
  countedCompile,
  editFingerprint,
  nativeParams,
  nativeRoot,
  packageAt,
  write,
} from "./helpers/native_resolution.js";

/** Give every fixture file an old modification time, so esbuild's file cache keeps it. */
async function age(root: string): Promise<void> {
  const past = new Date(Date.now() - 3_600_000);
  for (const entry of await fs.readdir(root, {
    recursive: true,
    withFileTypes: true,
  }))
    if (entry.isFile())
      await fs.utimes(path.join(entry.parentPath, entry.name), past, past);
}

async function nativePlan(params: BundleParams): Promise<ResolutionPlan> {
  const native = await bundleWith(params, build, unmeasured, {
    mode: "native",
  });
  assert.ok(!("generation" in native) && native.plan);
  return native.plan;
}

async function outcome(run: () => Promise<Bundled>) {
  try {
    return { fingerprint: editFingerprint((await run()).result) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const screen = (imports: string[], label: string) =>
  [
    ...imports.map((name) => `import { ${name} } from "./${name}.mjs";`),
    'import { tool } from "./vendor/node_modules/tool/tool.mjs";',
    `export const label = [tool(${JSON.stringify(label)}), ${imports.join(", ")}];`,
  ].join("\n");

/** A repository with a package, a vendored tool, plain modules, and a TypeScript configuration. */
async function fixture(root: string) {
  const chain = path.join(root, "node_modules/chain");
  await packageAt(chain, "chain", 'export { value } from "./part.mjs";');
  await write(path.join(chain, "part.mjs"), "export const value = 1;");
  await write(
    path.join(root, "vendor/node_modules/tool/tool.mjs"),
    "export const tool = (text) => text;",
  );
  for (const name of ["helper", "other"])
    await write(
      path.join(root, `${name}.mjs`),
      `export const ${name} = "${name}";`,
    );
  await write(path.join(root, "screen.mjs"), screen(["helper"], "title"));
  await write(
    path.join(root, "entry.mjs"),
    'export { value } from "chain";\nexport { label } from "./screen.mjs";',
  );
  await write(
    path.join(root, "second.mjs"),
    'export { other } from "./other.mjs";',
  );
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"strict":true}}',
  );
  await age(root);
}

test("guarded attempts rebuild one kept context and give the results of fresh compiles", async (context) => {
  matureMetadata(context);
  const root = await nativeRoot(context);
  await fixture(root);
  let params = nativeParams(root);
  let plan = await nativePlan(params);
  const { kept, counts } = countedKept();
  context.after(() => kept.dispose());
  const file = (name: string) => path.join(root, name);
  const manifest = file("node_modules/chain/package.json");
  const original = await fs.readFile(manifest, "utf8");
  // Each step: its change, the contexts created up to its end, and whether the core captures a new plan first.
  const steps: Array<[string, () => Promise<void>, number, boolean?]> = [
    [
      "the first edit",
      () => write(file("screen.mjs"), screen(["helper"], "one")),
      1,
    ],
    [
      "an edit inside one module",
      () => write(file("screen.mjs"), screen(["helper"], "two")),
      1,
    ],
    [
      "an added file",
      async () => {
        await write(file("added.mjs"), 'export const added = "added";');
        await write(file("screen.mjs"), screen(["helper", "added"], "three"));
      },
      1,
    ],
    [
      "a removed file",
      async () => {
        await fs.rm(file("helper.mjs"));
        await write(file("screen.mjs"), screen(["added"], "four"));
      },
      1,
    ],
    [
      "a changed package manifest",
      () =>
        write(
          manifest,
          JSON.stringify({
            name: "chain",
            main: "index.mjs",
            sideEffects: false,
          }),
        ),
      1,
      true,
    ],
    ["its restoration", () => write(manifest, original), 1, true],
    [
      "an edited TypeScript configuration",
      () =>
        write(file("tsconfig.json"), '{"compilerOptions":{"strict":false}}'),
      1,
      true,
    ],
    [
      "a failed compile",
      () => write(file("screen.mjs"), "export const label = ;"),
      1,
    ],
    [
      "its recovery",
      () => write(file("screen.mjs"), screen(["added"], "five")),
      2,
    ],
    [
      "changed bundle settings",
      async () => {
        params = nativeParams(root, {
          entryFiles: ["entry.mjs", "second.mjs"],
        });
      },
      3,
    ],
  ];
  for (const [name, change, created, recapture] of steps) {
    await change();
    if (recapture) plan = await nativePlan(params);
    // Fresh compiles of the guarded request: only a planned attempt after a failed guarded one.
    const counted = countedCompile();
    const guarded = await outcome(() =>
      bundle(
        params,
        counted.compile,
        undefined,
        undefined,
        "serveEdit",
        plan,
        (options) => kept.compile(options),
      ),
    );
    const fresh = await outcome(() =>
      bundle(params, build, undefined, undefined, "serveEdit"),
    );
    assert.deepEqual(
      differingFields(guarded, fresh),
      [],
      `${name}: fields that differ from a fresh compile`,
    );
    assert.equal(counts.created, created, `${name}: contexts created`);
    assert.equal(
      counted.counts.compilations,
      name === "a failed compile" ? 1 : 0,
      `${name}: fresh compiles`,
    );
  }
  assert.equal(
    counts.disposed,
    2,
    "the failed compile and the changed settings disposed of a context",
  );
});
