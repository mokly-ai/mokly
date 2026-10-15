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

test("style wrappers match unwrapped CommonJS imports in the same Mokly bundle", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-style-interop-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const require = createRequire(import.meta.url);
  const libraries = [
    ["styled", "styled-components"],
    ["emotion", "@emotion/react"],
    ["native", "react-native-web"],
  ] as const;
  for (const [binding, name] of libraries) {
    const original = path.dirname(require.resolve(`${name}/package.json`));
    for (const targetName of [name, `fixture-${binding}`]) {
      const target = path.join(root, "node_modules", targetName);
      await fs.cp(original, target, { recursive: true });
      const manifest = JSON.parse(
        await fs.readFile(path.join(target, "package.json"), "utf8"),
      );
      delete manifest.exports;
      manifest.name = targetName;
      await fs.writeFile(
        path.join(target, "package.json"),
        JSON.stringify(manifest),
      );
    }
  }
  for (const [name, type, extension] of [
    ["commonjs", "commonjs", "js"],
    ["mjs", "commonjs", "mjs"],
    ["mts", "module", "mts"],
    ["tsx-module", "module", "tsx"],
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
        ...libraries.flatMap(([binding, library]) =>
          [
            [binding, library],
            [`${binding}Plain`, `fixture-${binding}`],
          ].map(([local, specifier]) =>
            name === "require"
              ? `const ${local} = require("${specifier}");`
              : `import ${local} from "${specifier}";`,
          ),
        ),
        "const shape = value => ({type:typeof value,defaultType:typeof value?.default,keys:value ? Object.keys(value).sort() : []});",
        "export const wrapped = [styled, emotion, native].map(shape);",
        "export const unwrapped = [styledPlain, emotionPlain, nativePlain].map(shape);",
        "export const styledType = typeof styled; export const styledDivType = typeof styled?.div;",
      ].join("\n"),
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
    const result = evaluate(generation).entries[file]!;
    if (name === "tsx-module") {
      assert.equal(
        result.styledType,
        "function",
        "a TSX module must receive the styled function",
      );
      assert.equal(
        result.styledDivType,
        "function",
        "styled.div must remain callable",
      );
    }
    if (name === "mjs" || name === "mts")
      assert.equal(
        result.styledType,
        "object",
        `${name}: Node's default is module.exports`,
      );
    assert.deepEqual(result.wrapped, result.unwrapped, name);
    const shapes = result.unwrapped as Shape[];
    context.diagnostic(
      `${name}: ${JSON.stringify(shapes.map((value) => ({ type: value.type, defaultType: value.defaultType, keys: value.keys.length })))}`,
    );
  }
});
