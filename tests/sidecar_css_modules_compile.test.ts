import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";
import type { Definitions } from "../packages/mokly/src/generated/sidecar/Definitions.js";
import type { PageResult } from "../packages/mokly/src/generated/sidecar/PageResult.js";
import { Session } from "../packages/mokly/src/sidecar/session.js";

import { bundleParams } from "./helpers/sidecar.js";

test("CSS Modules compile each generation once at one and four imports", async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-css-compile-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  let compilations = 0;
  const session = new Session(
    "test",
    () => {},
    (options) => {
      compilations++;
      return build(options);
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  for (const size of [1, 4]) {
    const sourceRoot = path.join(root, String(size));
    await fs.mkdir(sourceRoot);
    const files = Array.from(
      { length: size },
      (_, index) => `${index}.module.css`,
    );
    for (const file of files)
      await fs.writeFile(
        path.join(sourceRoot, file),
        ".authored { color: red }",
      );
    await fs.writeFile(
      path.join(sourceRoot, "page.mjs"),
      [
        'import { definePage } from "@mokly/mokly";',
        ...files.map(
          (file, index) =>
            `import map${index}, { card as name${index} } from "./${file}";`,
        ),
        `export default definePage({title:"Maps",description:"Maps",relatedDocs:[],render:()=>'<main class="' + [${files.map((_, index) => `map${index}.card, name${index}`).join(",")}].join(' ') + '">Maps</main>'});`,
      ].join("\n"),
    );
    const before = compilations;
    const { generation } = (await session.call({
      id: 1,
      method: "bundle",
      params: bundleParams({
        sourceRoot,
        entryFiles: ["page.mjs"],
        storiesFiles: [],
        renderer: null,
      }),
    })) as BundleResult;
    assert.equal(
      compilations - before,
      1,
      "bundle compiles the generation once",
    );
    await fs.writeFile(
      path.join(sourceRoot, "page.mjs"),
      'throw new Error("source changed after bundle");',
    );
    const classMaps = Object.fromEntries(
      files.map((file, index) => [file, { card: `scoped-${size}-${index}` }]),
    );
    await session.call({
      id: 2,
      method: "cssModules",
      params: { generation, classMaps },
    });
    assert.equal(
      compilations - before,
      1,
      "installing maps must not compile again",
    );
    const definitions = (await session.call({
      id: 3,
      method: "describe",
      params: { generation },
    })) as Definitions;
    const handle = definitions.pages[0]!.handle;
    await session.call({
      id: 4,
      method: "bindings",
      params: {
        generation,
        entries: { [handle]: { path: "maps", title: "Maps" } },
      },
    });
    const rendered = (await session.call({
      id: 5,
      method: "renderPage",
      params: { generation, handle },
    })) as PageResult;
    assert.equal(
      rendered.html,
      `<main class="${files.flatMap((_, index) => [`scoped-${size}-${index}`, `scoped-${size}-${index}`]).join(" ")}">Maps</main>`,
    );
    assert.equal(
      compilations - before,
      1,
      "evaluation and render use the compiled generation",
    );
  }
  assert.equal(compilations, 2);
});

test("CSS Modules and runtime style adapters add no compile to a bundle", async (context) => {
  let compilations = 0;
  const session = new Session(
    "test",
    () => {},
    (options) => {
      compilations++;
      return build(options);
    },
  );
  context.after(() => session.dispose());
  await session.call({ id: 0, method: "hello", params: {} });
  // A plain entry of the same fixture sets the compile count of one bundle:
  // the native compile, and a planned compile when esbuild gives the native
  // modules a package type or TypeScript settings.
  await session.call({
    id: 1,
    method: "bundle",
    params: bundleParams({
      entryFiles: ["page.mockup.ts"],
      storiesFiles: [],
      renderer: null,
    }),
  });
  const plain = compilations;
  assert.ok(plain >= 1);
  const { generation, modules } = (await session.call({
    id: 2,
    method: "bundle",
    params: bundleParams({
      entryFiles: ["module-exports.mockup.tsx", "runtime-styles.mockup.tsx"],
      storiesFiles: [],
      renderer: null,
    }),
  })) as BundleResult;
  assert.equal(compilations - plain, plain);
  assert.ok(modules.every((module) => !module.path.startsWith("mokly-")));
  const imports = modules.find(
    (module) => module.path === "runtime-styles.mockup.tsx",
  )!.imports;
  for (const name of [
    "react-native-web",
    "styled-components",
    "@emotion/react",
  ])
    assert.ok(
      imports.some((file) => file.includes(`node_modules/${name}/`)),
      name,
    );
  await session.call({
    id: 3,
    method: "cssModules",
    params: {
      generation,
      classMaps: {
        "exports.module.css": {
          __esModule: "module",
          constructor: "constructor",
          café: "cafe",
        },
      },
    },
  });
  const definitions = (await session.call({
    id: 4,
    method: "describe",
    params: { generation },
  })) as Definitions;
  assert.equal(definitions.screens.length, 2);
  assert.equal(compilations - plain, plain);
});
