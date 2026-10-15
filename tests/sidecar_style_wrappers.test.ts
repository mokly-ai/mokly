import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { definitionData } from "../packages/mokly/src/authoring/runtime.js";
import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { evaluate } from "../packages/mokly/src/sidecar/evaluate.js";

import { styleFixture } from "./helpers/sidecar_style_fixture.js";

test("style subpaths capture the nested package registry with or without a root copy", async (context) => {
  const fixture = await styleFixture(context);
  for (const rootCopy of [false, true]) {
    if (rootCopy) {
      await fixture.write(
        "node_modules/react-native-web/package.json",
        '{"name":"react-native-web","main":"index.cjs"}',
      );
      await fixture.write(
        "node_modules/react-native-web/index.cjs",
        'exports.registry = "wrong root copy";',
      );
    }
    const { generation } = await bundle(
      fixture.params("nested.mockup.mjs"),
      build,
    );
    generation.maps = {};
    const result = evaluate(generation);
    assert.equal(
      (result.styleAdapters!.native as { registry: string }).registry,
      "nested",
    );
    const page = definitionData(
      result.entries["apps/web/nested.mockup.mjs"]!.default,
    )!;
    assert.equal((page.input.render as () => string)(), "Nested library");
  }
});

test("jsxImportSource captures the Emotion registry beside its JSX runtime", async (context) => {
  const fixture = await styleFixture(context);
  const { generation } = await bundle(
    fixture.params("emotion.mockup.tsx"),
    build,
  );
  generation.maps = {};
  const result = evaluate(generation);
  assert.equal(
    (result.styleAdapters!.emotion as { registry: string }).registry,
    "nested emotion",
  );
  const page = definitionData(
    result.entries["apps/web/emotion.mockup.tsx"]!.default,
  )!;
  assert.deepEqual(JSON.parse((page.input.render as () => string)()), {
    type: "main",
    props: { children: "Nested emotion" },
  });
});

test("adapter registry failures name the authored importer without virtual or absolute paths", async (context) => {
  const fixture = await styleFixture(context);
  await fixture.write(
    "apps/web/node_modules/react-native-web/package.json",
    '{"name":"react-native-web","exports":{".":"./absent.cjs","./subpath":"./subpath.js"}}',
  );
  await assert.rejects(
    bundle(fixture.params("nested.mockup.mjs"), build),
    (error: Error) => {
      assert.match(error.message, /apps\/web\/nested\.mockup\.mjs:1:/);
      assert.ok(!error.message.includes("mokly-style:"), error.message);
      assert.ok(!error.message.includes(fixture.root), error.message);
      return true;
    },
  );
});

test("adapter failures in selected dependencies use logical dependency names", async (context) => {
  const fixture = await styleFixture(context);
  await fixture.write("apps/web/importer.mjs", 'import "fixture-importer";');
  await fixture.write(
    "installation/node_modules/fixture-importer/package.json",
    '{"main":"index.mjs"}',
  );
  await fixture.write(
    "installation/node_modules/fixture-importer/index.mjs",
    'import "react-native-web/subpath";',
  );
  await fixture.write(
    "installation/node_modules/react-native-web/package.json",
    '{"name":"react-native-web","exports":{".":"./absent.cjs","./subpath":"./subpath.js"}}',
  );
  await fixture.write(
    "installation/node_modules/react-native-web/subpath.js",
    'exports.label="nested";',
  );
  const params = fixture.params("importer.mjs");
  params.sourceRoot = path.join(fixture.root, "apps/web");
  params.configurationDirectory = ".";
  params.entryFiles = ["importer.mjs"];
  params.moduleResolution.packageRoots = [
    path.join(fixture.root, "installation"),
  ];
  await assert.rejects(bundle(params, build), (error: Error) => {
    assert.match(
      error.message,
      /node_modules\/fixture-importer\/index\.mjs:1:/,
    );
    assert.ok(!error.message.includes("../"), error.message);
    assert.ok(!error.message.includes(fixture.root), error.message);
    assert.ok(!error.message.includes("mokly-style:"), error.message);
    return true;
  });
});
