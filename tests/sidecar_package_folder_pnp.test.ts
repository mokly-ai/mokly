import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import type { TestContext } from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";
import { currentEvidence } from "../packages/mokly/src/sidecar/physical-inputs.js";

import { countedCompile, write } from "./helpers/native_resolution.js";
import { planCapture } from "./helpers/plan_capture.js";
import { pnpFolder } from "./helpers/pnp_folder.js";
import type { PnpForm } from "./helpers/pnp_folder.js";

for (const form of ["json", "binding", "object", "concatenation"] as const)
  test(`full PnP ${form} folder evidence rejects a preferred file with repeated metadata`, async (context) => {
    await nonFolder(context, form);
    const fixture = await pnpFolder(context, form, true, form === "binding");
    const counted = countedCompile();
    const first = await bundle(
      fixture.params,
      counted.compile,
      undefined,
      planCapture(fixture.root),
    );
    const evidence = first.result.compiled.reuseEvidence;
    assert.equal(evidence.complete, true);
    assert.equal(evidence.durable, true);
    assert.match(first.result.compiled.code, /original-index/);
    assert.equal(counted.counts.compilations, 1);
    assert.equal(counted.consumerResolves(), 1);
    assert.equal(counted.counts.resolves.get("mokly-reuse-evidence") ?? 0, 0);
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params))?.runtimeKey,
      first.result.compiled.runtimeKey,
    );
    assert.equal(counted.counts.compilations, 1, "reuse never invokes esbuild");
    await fixture.addPreferred();
    const native = await bundle(fixture.params, build);
    assert.match(native.result.compiled.code, /preferred-file/);
    assert.equal(currentEvidence(evidence), false);
    assert.equal(
      (await reuse([first.generation], fixture.params))?.runtimeKey,
      undefined,
    );
  });

async function nonFolder(context: TestContext, form: PnpForm): Promise<void> {
  const fixture = await pnpFolder(context, form, false);
  const counted = countedCompile();
  const first = await bundle(
    fixture.params,
    counted.compile,
    undefined,
    planCapture(fixture.root),
  );
  assert.equal(first.result.compiled.reuseEvidence.complete, true);
  assert.equal(first.result.compiled.reuseEvidence.durable, true);
  await fixture.unrelated();
  assert.equal(currentEvidence(first.result.compiled.reuseEvidence), true);
  assert.equal(
    (await reuse([first.generation], fixture.params))?.runtimeKey,
    first.result.compiled.runtimeKey,
  );
  assert.equal(counted.counts.compilations, 1);
  assert.equal(counted.consumerResolves(), 1);
}

test("marked PnP alias folders keep unrelated reuse and reject a preferred file", async (context) => {
  const fixture = await pnpFolder(context, "binding", true, true);
  const first = await bundle(
    fixture.params,
    build,
    undefined,
    undefined,
    "serveEdit",
  );
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
    (await reuse([first.generation], fixture.params, "serveEdit"))?.runtimeKey,
    undefined,
  );
});

test("full PnP discovery keeps ordinary reuse below the metadata cap and declines it above the cap", async (context) => {
  for (const row of [
    { padding: 1_047_552, complete: true },
    { padding: 1_048_676, complete: false },
  ]) {
    const fixture = await pnpFolder(context, "json", false);
    await write(
      path.join(fixture.root, ".yarn/chosen/package.json"),
      JSON.stringify({
        name: "chosen",
        exports: { "./sub/value": "./lib/value.js" },
        padding: "x".repeat(row.padding),
      }),
    );
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      planCapture(fixture.root),
    );
    assert.match(first.result.compiled.code, /original-index/);
    assert.equal(
      first.result.compiled.reuseEvidence.complete,
      row.complete,
      String(row.padding),
    );
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params))?.runtimeKey,
      row.complete ? first.result.compiled.runtimeKey : undefined,
      String(row.padding),
    );
  }
});

test("an unsupported PnP folder evidence depth keeps the successful native compile", async (context) => {
  const fixture = await pnpFolder(context, "json");
  let target: unknown = "./lib/";
  for (let depth = 0; depth < 35; depth++) target = { node: target };
  await write(
    path.join(fixture.root, ".yarn/chosen/package.json"),
    JSON.stringify({ name: "chosen", exports: { "./sub/": target } }),
  );
  const compilation = bundle(fixture.params, build);
  await assert.doesNotReject(compilation);
  const result = await compilation;
  assert.match(result.result.compiled.code, /original-index/);
  assert.equal(result.result.compiled.reuseEvidence.complete, false);
  assert.equal(result.result.plan, undefined);
});
