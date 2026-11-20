import assert from "node:assert/strict";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { folderPackage } from "./helpers/package_folder.js";

const nestedManifest =
  "{" +
  Array.from({ length: 160 }, () => '"main":"./nested/choice"').join(",") +
  "}";

test("duplicate folder targets and main fields keep a fitting description reusable", async (context) => {
  const fixture = await folderPackage(context, {
    name: "duplicate fitting description",
    manifest: JSON.stringify({
      name: "chosen",
      exports: {
        "./sub/": Array.from({ length: 160 }, () => ({ node: "./lib/" })),
      },
    }),
    nestedManifest,
    original: "lib/value/nested/choice/index.js",
    preferred: "lib/value/nested/choice.ts",
  });
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  assert.equal(first.result.compiled.reuseEvidence.uncaptured, "serveEdit");
  await fixture.unrelated();
  assert.equal(
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  await fixture.addPreferred();
  const native = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(native.result.compiled.code, /preferred-file/);
  assert.equal(
    await reuse([first.generation], fixture.params, "serveEdit"),
    undefined,
  );
});

test("an overlimit folder description keeps native output and withholds its marker", async (context) => {
  const tail = [
    "a".repeat(200),
    "b".repeat(200),
    "c".repeat(200),
    "value",
  ].join("/");
  const targets = [
    "./lib/",
    ...Array.from({ length: 2047 }, (_, index) => `./inactive-${index}/`),
  ];
  const fixture = await folderPackage(context, {
    name: "overlimit description",
    manifest: JSON.stringify({
      name: "chosen",
      exports: {
        "./sub/": targets.map((target) => ({ node: target, default: target })),
      },
    }),
    request: "chosen/sub/" + tail,
    original: "lib/" + tail + "/index.js",
  });
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
  assert.match(first.result.compiled.code, /original-index/);
  assert.deepEqual(first.result.compiled.reuseEvidence, {
    complete: false,
    durable: false,
    inputs: {},
  });
  assert.equal(
    await reuse([first.generation], fixture.params, "serveEdit"),
    undefined,
  );
});
