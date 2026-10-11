import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { cleanupBaselines } from "../dist/baseline/cleanup.js";

import { baselineFixture } from "./helpers/baseline_fixture.js";

for (const mode of ["success", "exhausted", "cancelled", "EACCES"] as const) {
  test(`baseline acquisition handles retention interleaving: ${mode}`, async (t) => {
    const { builder, fs, runner, clock, request, calls } = baselineFixture();
    const activeRequest = { ...request, commit: "b".repeat(40) };
    await builder.build(activeRequest);
    calls.length = 0;
    const active = cacheLayout(request.repoRoot, activeRequest.commit);
    const pending = cacheLayout(request.repoRoot, request.commit);
    const ignore = path.join(active.cache, ".gitignore");
    const ignoreBytes = await fs.read(ignore, 1024);
    const locks = path.join(active.cache, "locks");
    fs.put(locks, "directory");
    const controller = new AbortController();
    const acquire = fs.acquireLock.bind(fs);
    const events: string[] = [];
    let attempts = 0;
    let cleanup = false;
    t.mock.method(
      fs,
      "acquireLock",
      async (file: string, bytes: Uint8Array) => {
        if (file !== pending.lock || cleanup) return acquire(file, bytes);
        attempts++;
        assert.equal((await fs.stat(pending.entry))?.kind, "directory");
        events.push("publish");
        if (mode === "EACCES")
          throw Object.assign(new Error("access refused"), { code: "EACCES" });
        if (mode === "success" && attempts === 2) return acquire(file, bytes);
        cleanup = true;
        assert.deepEqual(
          await cleanupBaselines(fs, runner, clock, active, activeRequest, 1),
          [],
        );
        cleanup = false;
        assert.equal(await fs.stat(pending.entry), undefined);
        events.push("retired");
        if (mode === "cancelled") controller.abort();
        throw Object.assign(
          new Error("entry removed before lock publication"),
          { code: "ENOENT" },
        );
      },
    );
    const operation = builder.build({ ...request, signal: controller.signal });
    if (mode === "success") {
      assert.equal((await operation).cacheHit, false);
      assert.deepEqual(events, ["publish", "retired", "publish"]);
      assert.ok(await fs.stat(pending.marker));
    } else {
      await assert.rejects(operation, {
        code:
          mode === "cancelled"
            ? "baseline-interrupted"
            : "baseline-output-invalid",
      });
      assert.equal(attempts, mode === "exhausted" ? 3 : 1);
      assert.equal(
        calls.length,
        0,
        "failed lock acquisition must not start a recipe",
      );
      assert.equal(await fs.stat(pending.marker), undefined);
    }
    assert.equal(await fs.stat(pending.lock), undefined);
    assert.deepEqual(await fs.read(ignore, 1024), ignoreBytes);
    assert.equal((await fs.stat(locks))?.kind, "directory");
    assert.ok(await fs.stat(active.marker));
  });
}
