import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { build } from "esbuild";

import { bundle } from "../packages/mokly/src/sidecar/bundle.js";
import { reuse } from "../packages/mokly/src/sidecar/compiled.js";

import { nestedPnp } from "./helpers/pnp_reachability.js";

for (const capture of ["full", "serveEdit"] as const) {
  test(`${capture} PnP exact ownership ignores an unreachable outer folder`, async (context) => {
    const fixture = await nestedPnp(context);
    const first = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      capture,
    );
    assert.match(first.result.compiled.code, /original-index/);
    assert.equal(
      first.result.compiled.reuseEvidence.complete,
      capture === "full",
    );
    assert.equal(
      first.result.compiled.reuseEvidence.uncaptured,
      capture === "serveEdit" ? "serveEdit" : undefined,
    );
    await fixture.unrelated();
    assert.equal(
      (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
      first.result.compiled.runtimeKey,
    );
    await fixture.addPreferred();
    const fresh = await bundle(
      fixture.params,
      build,
      undefined,
      undefined,
      capture,
    );
    assert.match(fresh.result.compiled.code, /original-index/);
    assert.equal(
      (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
      first.result.compiled.runtimeKey,
    );
  });

  test(`${capture} PnP registry-only ownership changes end narrowed ordinary reuse`, async (context) => {
    for (const nearer of [false, true]) {
      const fixture = await nestedPnp(context);
      const registryDirectory = nearer
        ? path.join(fixture.root, "configuration")
        : fixture.root;
      if (nearer) {
        await fs.mkdir(registryDirectory);
        fixture.params.configurationDirectory = "configuration";
      }
      await fixture.addPreferred();
      const first = await bundle(
        fixture.params,
        build,
        undefined,
        undefined,
        capture,
      );
      assert.match(first.result.compiled.code, /original-index/);
      await fixture.owner("outer", false, registryDirectory);
      const fresh = await bundle(
        fixture.params,
        build,
        undefined,
        undefined,
        capture,
      );
      assert.match(fresh.result.compiled.code, /preferred-file/);
      assert.equal(
        (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
        undefined,
        nearer ? "nearer statefile appearance" : "pinned statefile edit",
      );
    }
  });
}

test("reachable overlap and package-directory second resolves retain their folder checks", async (context) => {
  for (const capture of ["full", "serveEdit"] as const)
    for (const row of ["selected", "overlap", "second-start"] as const) {
      const fixture = await nestedPnp(context, row === "second-start");
      await fixture.owner(
        row === "selected" ? "outer" : "inner",
        row === "overlap",
      );
      const first = await bundle(
        fixture.params,
        build,
        undefined,
        undefined,
        capture,
      );
      assert.match(first.result.compiled.code, /original-index/);
      await fixture.unrelated();
      assert.equal(
        (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
        first.result.compiled.runtimeKey,
        row,
      );
      await fixture.addPreferred();
      const fresh = await bundle(
        fixture.params,
        build,
        undefined,
        undefined,
        capture,
      );
      assert.match(
        fresh.result.compiled.code,
        row === "overlap" ? /original-index/ : /preferred-file/,
      );
      assert.equal(
        (await reuse([first.generation], fixture.params, capture))?.runtimeKey,
        undefined,
        row,
      );
    }
});
