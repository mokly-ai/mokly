import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import { bundleParams } from "./helpers/sidecar.js";

interface Shape {
  type: string;
  defaultType: string;
  keys: string[];
}

test("style wrappers preserve esbuild default-import interop for CommonJS libraries", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-style-interop-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const require = createRequire(import.meta.url);
  for (const name of [
    "styled-components",
    "@emotion/react",
    "react-native-web",
  ]) {
    const original = path.dirname(require.resolve(`${name}/package.json`));
    const target = path.join(root, "node_modules", name);
    await fs.cp(original, target, { recursive: true });
    const manifest = JSON.parse(
      await fs.readFile(path.join(target, "package.json"), "utf8"),
    );
    delete manifest.exports;
    await fs.writeFile(
      path.join(target, "package.json"),
      JSON.stringify(manifest),
    );
  }
  for (const [name, type, extension] of [
    ["commonjs", "commonjs", "js"],
    ["mjs", "commonjs", "mjs"],
    ["module", "module", "js"],
    ["require", "commonjs", "cjs"],
  ] as const) {
    const sourceRoot = path.join(root, name!);
    await fs.mkdir(sourceRoot);
    await fs.writeFile(
      path.join(sourceRoot, "package.json"),
      JSON.stringify({ type }),
    );
    const file = `entry.${extension}`;
    await fs.writeFile(
      path.join(sourceRoot, file),
      [
        ...[
          ["styled", "styled-components"],
          ["emotion", "@emotion/react"],
          ["native", "react-native-web"],
        ].map(([binding, library]) =>
          name === "require"
            ? `const ${binding} = require("${library}");`
            : `import ${binding} from "${library}";`,
        ),
        "export const info = [styled, emotion, native].map(value => ({type:typeof value,defaultType:typeof value?.default,keys:value ? Object.keys(value).sort() : []}));",
      ].join("\n"),
    );
    const plain = await build({
      absWorkingDir: sourceRoot,
      entryPoints: [file],
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      mainFields: ["main"],
      conditions: [],
      nodePaths: [
        path.join(root, "node_modules"),
        path.resolve("node_modules"),
      ],
      external: ["react", "react-dom", "react-dom/*"],
    });
    const module = { exports: {} as { info: Shape[] } };
    new Function("module", "exports", "require", plain.outputFiles[0]!.text)(
      module,
      module.exports,
      require,
    );
    const { generation } = await bundle(
      bundleParams({
        sourceRoot,
        entryFiles: [file],
        renderer: null,
        storiesFiles: [],
        moduleResolution: {
          ...bundleParams().moduleResolution,
          mainFields: ["main"],
          packageRoots: [root, path.resolve(".")],
        },
      }),
      build,
    );
    generation.maps = {};
    const wrapped = evaluate(generation).entries[file]!.info;
    assert.deepEqual(wrapped, module.exports.info, name);
    context.diagnostic(
      `${name}: ${JSON.stringify(module.exports.info.map((value) => ({ type: value.type, defaultType: value.defaultType, keys: value.keys.length })))}`,
    );
  }
});
