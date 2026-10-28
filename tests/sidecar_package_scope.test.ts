import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { PackageScope } from "../packages/mokly/src/sidecar/package-scope.js";

import { nativeRoot, write } from "./helpers/native_resolution.js";

const manifests: Record<string, unknown> = {
  "pkg-false": { sideEffects: false },
  "pkg-true": { sideEffects: true },
  "pkg-absent": {},
  "pkg-empty": { sideEffects: [] },
  "pkg-exact": { sideEffects: ["./src/side.js"] },
  "pkg-bare": { sideEffects: ["*.css", "polyfill.js"] },
  "pkg-glob": { sideEffects: ["./src/**/effects/*.js", "./lib/?.js"] },
  "pkg-invalid": { sideEffects: [1, "./ok.js"] },
  "pkg-string": { sideEffects: "yes" },
  "pkg-nested": { sideEffects: false },
  "pkg-nested/inner": { sideEffects: true },
};
const files = [
  "pkg-false/index.js",
  "pkg-false/sub/a.js",
  "pkg-true/index.js",
  "pkg-absent/index.js",
  "pkg-empty/index.js",
  "pkg-exact/src/side.js",
  "pkg-exact/src/pure.js",
  "pkg-bare/style.css",
  "pkg-bare/lib/polyfill.js",
  "pkg-bare/lib/plain.js",
  "pkg-glob/src/a/b/effects/e.js",
  "pkg-glob/src/effects/e.js",
  "pkg-glob/src/pure.js",
  "pkg-glob/lib/a.js",
  "pkg-glob/lib/ab.js",
  "pkg-invalid/ok.js",
  "pkg-invalid/other.js",
  "pkg-string/index.js",
  "pkg-nested/index.js",
  "pkg-nested/inner/x.js",
];

test("side-effect flags match esbuild's own resolver for each manifest shape", async (context) => {
  const root = await nativeRoot(context);
  const modules = path.join(root, "node_modules");
  for (const [directory, manifest] of Object.entries(manifests))
    await write(
      path.join(modules, directory, "package.json"),
      JSON.stringify(manifest),
    );
  for (const file of files) await write(path.join(modules, file), "");
  const scope = new PackageScope();
  const expected = new Map<string, boolean>();
  await build({
    stdin: { contents: "", resolveDir: root },
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "esbuild-side-effects",
        setup(builder) {
          builder.onStart(async () => {
            for (const file of files)
              expected.set(
                file,
                (
                  await builder.resolve(path.join(modules, file), {
                    kind: "import-statement",
                    resolveDir: root,
                  })
                ).sideEffects,
              );
          });
        },
      },
    ],
  });
  for (const file of files)
    assert.equal(
      await scope.sideEffects(path.join(modules, file)),
      expected.get(file),
      file,
    );
  assert.ok([...expected.values()].includes(false));
  assert.ok([...expected.values()].includes(true));
});

test("parse settings follow the package type and tsconfig scopes", async (context) => {
  const root = await nativeRoot(context);
  await write(
    path.join(root, "tsconfig.json"),
    '{"compilerOptions":{"strict":true}}',
  );
  await write(path.join(root, "app/package.json"), '{"type":"module"}');
  await write(path.join(root, "lib/package.json"), '{"type":"commonjs"}');
  await write(path.join(root, "node_modules/plain/package.json"), "{}");
  await write(
    path.join(root, "node_modules/typed/package.json"),
    '{"type":"module"}',
  );
  const scope = new PackageScope();
  const settings = async (file: string) =>
    scope.parseSettings(path.join(root, file));
  // Outside node_modules the tsconfig applies to every file.
  assert.equal(await settings("app/entry.tsx"), true);
  assert.equal(await settings("data.json"), true);
  // Inside node_modules only a package type for a JavaScript or TypeScript
  // extension applies; the extension decides for .mjs and .cjs files.
  assert.equal(await settings("node_modules/plain/index.js"), false);
  assert.equal(await settings("node_modules/typed/index.js"), true);
  assert.equal(await settings("node_modules/typed/index.ts"), true);
  assert.equal(await settings("node_modules/typed/index.mjs"), false);
  assert.equal(await settings("node_modules/typed/data.json"), false);
  const bare = new PackageScope();
  const outside = await nativeRoot(context);
  await write(path.join(outside, "lib/package.json"), '{"type":"commonjs"}');
  await write(path.join(outside, "plain/package.json"), "{}");
  await write(path.join(outside, "odd/package.json"), '{"type":"esm"}');
  await write(
    path.join(outside, "config/jsconfig.json"),
    '{"compilerOptions":{"jsx":"react"}}',
  );
  assert.equal(
    await bare.parseSettings(path.join(outside, "lib/x.cts")),
    false,
  );
  assert.equal(await bare.parseSettings(path.join(outside, "lib/x.js")), true);
  assert.equal(
    await bare.parseSettings(path.join(outside, "plain/x.js")),
    false,
  );
  assert.equal(await bare.parseSettings(path.join(outside, "odd/x.js")), false);
  assert.equal(
    await bare.parseSettings(path.join(outside, "config/x.js")),
    true,
  );
});

for (const [config, expected] of [
  ["{}", false],
  ['{"compilerOptions":{"baseUrl":".","paths":{"@/*":["src/*"]}}}', false],
  ['{"compilerOptions":{"module":"NodeNext","lib":["DOM"]}}', false],
  ['{"compilerOptions":{"jsxImportSource":"preact"}}', true],
  ['{"compilerOptions":{"experimentalDecorators":true}}', true],
  ['{"extends":"./base.json"}', true],
  ['{"compilerOptions":{}, // comment\n}', true],
] as const)
  test(`a tsconfig counts its parse options: ${config}`, async (context) => {
    const root = await nativeRoot(context);
    await write(path.join(root, "tsconfig.json"), config);
    assert.equal(
      await new PackageScope().parseSettings(path.join(root, "src/entry.ts")),
      expected,
    );
  });
