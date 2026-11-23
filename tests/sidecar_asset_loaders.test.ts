import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import type { BundleResult } from "../packages/mokly/src/generated/sidecar/BundleResult.js";

import { compile, fixture } from "./helpers/sidecar_assets.js";

function assertNotImported(result: BundleResult, file: string) {
  const module = result.modules.find((module) => module.path === file);
  assert.ok(module, file);
  assert.equal(module.importedAsset, undefined, file);
}

test("consumer suffixes and explicit attributes precede the asset default", async (context) => {
  const cases: Array<{
    file: string;
    attribute?: string;
    loaders?: Record<string, string>;
    bytes: string;
    expression?: string;
    expected: unknown;
  }> = [
    {
      file: "value.png",
      loaders: { ".png": "text" },
      bytes: "text",
      expected: "text",
    },
    {
      file: "value.icon.png",
      loaders: { ".png": "binary", ".icon.png": "text" },
      bytes: "longest",
      expected: "longest",
    },
    {
      file: "value.png",
      attribute: "text",
      bytes: "attribute",
      expected: "attribute",
    },
    {
      file: "value.png",
      attribute: "bytes",
      bytes: "AB",
      expression: "Array.from(value)",
      expected: [65, 66],
    },
    {
      file: "value.png",
      attribute: "json",
      bytes: '{"name":"json"}',
      expected: { name: "json" },
    },
    { file: "value.txt", bytes: "plain text", expected: "plain text" },
  ];
  for (const scenario of cases) {
    const root = await fixture(context);
    await fs.writeFile(path.join(root, scenario.file), scenario.bytes);
    const attribute = scenario.attribute
      ? ` with {type:${JSON.stringify(scenario.attribute)}}`
      : "";
    const built = await compile(
      root,
      `import value from ${JSON.stringify("./" + scenario.file)}${attribute};`,
      scenario.expression ?? "value",
      scenario.loaders,
    );
    assert.deepEqual(built.value, scenario.expected, JSON.stringify(scenario));
    assertNotImported(built.result, scenario.file);
  }
});

test("a text import attribute overrides JSON source and consumer loaders", async (context) => {
  const root = await fixture(context);
  const contents = '{"name":"source"}';
  await fs.writeFile(path.join(root, "value.json"), contents);
  const imports = 'import value from "./value.json" with {type:"text"};';
  const source = await compile(root, imports, "value");
  const consumer = await compile(root, imports, "value", { ".json": "json" });
  assert.deepEqual([source.value, consumer.value], [contents, contents]);
  assertNotImported(source.result, "value.json");
  assertNotImported(consumer.result, "value.json");
});

test("a bytes import attribute overrides a dataurl loader and the text default", async (context) => {
  const root = await fixture(context);
  await fs.writeFile(path.join(root, "value.png"), Buffer.from([0, 255]));
  await fs.writeFile(path.join(root, "value.txt"), "AB");
  const { result, value } = await compile(
    root,
    `import png from "./value.png" with {type:"bytes"};
import txt from "./value.txt" with {type:"bytes"};`,
    "[Array.from(png), Array.from(txt)]",
    { ".png": "dataurl" },
  );
  assert.deepEqual(value, [
    [0, 255],
    [65, 66],
  ]);
  assertNotImported(result, "value.png");
  assertNotImported(result, "value.txt");
});

test("a JSON import attribute overrides a file loader and keeps named exports", async (context) => {
  const root = await fixture(context);
  await fs.writeFile(path.join(root, "value.txt"), '{"name":"named"}');
  const compiled = compile(
    root,
    'import {name} from "./value.txt" with {type:"json"};',
    "name",
    { ".txt": "file" },
  );
  await assert.doesNotReject(compiled);
  const { result, value } = await compiled;
  assert.equal(value, "named");
  assertNotImported(result, "value.txt");
});

for (const [file, loaders, token] of [
  ["value.png", { ".png": "file" }, "mokly-asset:[value.png]"],
  [
    "value.icon.png",
    { ".png": "text", ".icon.png": "file" },
    "mokly-asset:[value.icon.png]",
  ],
  ["value.txt", { ".txt": "file" }, "mokly-asset:[value.txt]"],
] as const) {
  test(`a file loader delivers ${file} as an asset`, async (context) => {
    const root = await fixture(context);
    const bytes = Buffer.from([0, 255, 128]);
    await fs.writeFile(path.join(root, file), bytes);
    const compiled = compile(
      root,
      `import value from "./${file}";`,
      "value",
      loaders,
    );
    await assert.doesNotReject(compiled);
    const { result, value } = await compiled;
    assert.equal(value, token);
    assert.deepEqual(
      result.modules.find((module) => module.path === file),
      {
        path: file,
        imports: [],
        digest: createHash("sha256").update(bytes).digest("hex"),
        importedAsset: true,
      },
    );
  });
}

test("a file loader rejects an unsupported type with a logical path", async (context) => {
  const root = await fixture(context);
  await fs.mkdir(path.join(root, "media"));
  await fs.writeFile(path.join(root, "media/model.glb"), "opaque");
  await assert.rejects(
    compile(root, 'import value from "./media/model.glb";', "value", {
      ".glb": "file",
    }),
    {
      code: "bundle-failed",
      message:
        "entry.mjs:2:19: file loader cannot deliver media/model.glb; use a binary or text loader for this type",
    },
  );
});

test("unsupported extensions fail bundling without a loader", async (context) => {
  for (const extension of ["unknown", "PNG"]) {
    const root = await fixture(context);
    await fs.writeFile(path.join(root, "value." + extension), "opaque");
    await assert.rejects(
      compile(root, `import value from "./value.${extension}";`, "value"),
      { code: "bundle-failed", message: /No loader is configured/u },
    );
  }
});
