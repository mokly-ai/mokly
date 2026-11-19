import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { planKey } from "../packages/mokly/src/sidecar/native-resolution.js";
import { currentEvidence } from "../packages/mokly/src/sidecar/physical-inputs.js";

import { folderPackage } from "./helpers/package_folder.js";
import type { FolderCase } from "./helpers/package_folder.js";
import { planCapture } from "./helpers/plan_capture.js";

const cases: FolderCase[] = [
  {
    name: "self identity mapping",
    manifest: '{"name":"chosen","exports":{"./sub/":"./sub/"}}',
    original: "sub/value/index.js",
    preferred: "sub/value.ts",
  },
  { name: "installed non-identity mapping", route: "installed" },
  { name: "linked physical package root", route: "linked" },
  {
    name: "aliased self from the configuration directory",
    route: "alias",
    request: "shortcut/sub/value",
  },
  { name: "configured package lookup root", route: "nodePaths" },
  {
    name: "dependency bare import in a saved native plan",
    route: "dependency",
  },
  {
    name: "nested condition and array targets",
    manifest:
      '{"name":"chosen","exports":{"./sub/":[{"node":["./lib/"],"default":"./other/"},"./last/"]}}',
    extra: ["other/value/index.js", "last/value/index.js"],
  },
  {
    name: "an inactive condition target remains observed",
    manifest:
      '{"name":"chosen","exports":{"./sub/":{"node":"./lib/","default":"./other/"}}}',
    extra: ["other/value/index.js"],
    preferred: "other/value.ts",
    expected: "original-index",
  },
  {
    name: "a later array target remains observed",
    manifest: '{"name":"chosen","exports":{"./sub/":["./lib/","./last/"]}}',
    extra: ["last/value/index.js"],
    preferred: "last/value.ts",
    expected: "original-index",
  },
  {
    name: "percent-decoded target folder",
    manifest: '{"name":"chosen","exports":{"./sub/":"./lib%20space/"}}',
    original: "lib space/value/index.js",
    preferred: "lib space/value.ts",
  },
  {
    name: "percent-decoded request tail",
    request: "chosen/sub/with%20space/value",
    original: "lib/with space/value/index.js",
    preferred: "lib/with space/value.ts",
  },
  {
    name: "first repeated folder key",
    manifest:
      '{"name":"chosen","exports":{"./sub/":"./lib/","./sub/":"./other/"}}',
    extra: ["other/value/index.js"],
  },
  {
    name: "first repeated exports field",
    manifest:
      '{"name":"chosen","exports":{"./sub/":"./lib/"},"exports":{"./sub/":"./other/"}}',
    extra: ["other/value/index.js"],
  },
  {
    name: "first repeated condition key",
    manifest:
      '{"name":"chosen","exports":{"./sub/":{"node":"./lib/","node":"./other/"}}}',
    extra: ["other/value/index.js"],
  },
  {
    name: "first repeated package name",
    manifest: '{"name":"chosen","name":"other","exports":{"./sub/":"./lib/"}}',
  },
  {
    name: "nested folder main-field candidate",
    original: "lib/value/nested/choice/index.js",
    preferred: "lib/value/nested/choice.ts",
    nestedManifest: '{"main":"./nested/choice"}',
  },
  {
    name: "first repeated nested main field",
    original: "lib/value/nested/choice/index.js",
    preferred: "lib/value/nested/choice.ts",
    nestedManifest: '{"main":"./nested/choice","main":"./other/choice"}',
    extra: ["lib/value/other/choice/index.js"],
  },
];

for (const row of cases)
  test(`full package-folder evidence rejects ${row.name} after a candidate appears`, async (context) => {
    const fixture = await folderPackage(context, row);
    const { params, root } = fixture;
    const first = await bundle(params, build, undefined, planCapture(root));
    const evidence = first.result.compiled.reuseEvidence;
    assert.equal(evidence.complete, true);
    assert.equal(evidence.durable, true);
    assert.match(first.result.compiled.code, /original-index/);
    assert.ok(
      first.result.plan,
      "the full capture must return its native plan",
    );
    assert.deepEqual(
      first.result.plan.imports[
        planKey(fixture.dependency, "chosen/sub/value", "import-statement")
      ],
      row.route === "dependency"
        ? { path: fixture.original, sideEffects: true }
        : undefined,
      "only the dependency fixture plans this bare import",
    );
    await fixture.unrelated();
    assert.equal(
      currentEvidence(evidence),
      true,
      "unrelated additions keep the plan current",
    );
    assert.equal(
      (await reuse([first.generation], params))?.runtimeKey,
      first.result.compiled.runtimeKey,
      "unrelated additions retain compiled reuse",
    );
    await fixture.addPreferred();
    const native = await bundle(params, build, undefined, planCapture(root));
    assert.match(
      native.result.compiled.code,
      new RegExp(row.expected ?? "preferred-file"),
    );
    assert.equal(
      currentEvidence(evidence),
      false,
      "the saved plan must reject the changed selection",
    );
    assert.equal(await reuse([first.generation], params), undefined);
    assert.equal(
      evidence.inputs[path.dirname(fixture.preferred)]?.kind,
      "directory",
      "the physical candidate target owns the listing",
    );
  });
