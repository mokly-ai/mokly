import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../packages/mokly/dist/baseline/cache_layout.js";
import { CachedBaselineBuilder } from "../packages/mokly/dist/baseline/rebuild.js";

import { baselineFixture, success } from "./helpers/baseline_fixture.js";

for (const failure of [
  "stat",
  "lock",
  "rename",
  "remove",
  "concurrent-removal",
  "release",
  "list",
] as const) {
  test(`completed output survives cleanup ${failure} failure`, async (t) => {
    const fixture = baselineFixture();
    const { fs, request, runner, clock, options, reporter, maintenance } =
      fixture;
    const victim = cacheLayout(request.repoRoot, "b".repeat(40));
    const another = cacheLayout(request.repoRoot, "c".repeat(40));
    const active = cacheLayout(request.repoRoot, request.commit);
    for (const layout of [another, victim]) {
      await fixture.builder.build({
        ...request,
        commit: path.basename(layout.entry),
      });
      clock.time++;
    }
    const diagnostic = `injected ${failure} failure`;
    const stat = fs.stat.bind(fs);
    const acquire = fs.acquireLock.bind(fs);
    const remove = fs.remove.bind(fs);
    const rename = fs.rename.bind(fs);
    const list = fs.list.bind(fs);
    const fail = () => {
      throw Object.assign(new Error(diagnostic), {
        code: failure === "concurrent-removal" ? "ENOENT" : "EACCES",
      });
    };
    t.mock.method(fs, "stat", async (file: string) => {
      if (failure === "stat" && file === victim.entry) fail();
      return stat(file);
    });
    t.mock.method(
      fs,
      "acquireLock",
      async (file: string, bytes: Uint8Array) => {
        if (file === victim.lock) {
          if (failure === "concurrent-removal") {
            await remove(victim.entry);
            fail();
          }
          if (failure === "lock") fail();
        }
        return acquire(file, bytes);
      },
    );
    t.mock.method(fs, "rename", async (from: string, to: string) => {
      if (failure === "rename" && from === victim.entry) fail();
      await rename(from, to);
    });
    t.mock.method(fs, "remove", async (file: string) => {
      if (
        failure === "remove" &&
        file ===
          path.join(active.entry, `discard-${path.basename(victim.entry)}`)
      )
        fail();
      if (failure === "release" && file === active.lock) fail();
      await remove(file);
    });
    t.mock.method(fs, "list", async (directory: string) => {
      if (failure === "list" && directory === active.root) fail();
      return list(directory);
    });
    const builder = new CachedBaselineBuilder(fs, runner, clock, reporter, {
      ...options,
      retainedCount: 1,
    });
    const events: string[] = [];
    const result = await builder.build({
      ...request,
      onProgress: (event) => events.push(event.type),
    });
    assert.deepEqual(events, ["start", "complete"]);
    assert.equal(result.cacheHit, false);
    assert.ok(await fs.stat(active.marker));
    assert.ok(await fs.stat(active.output));
    assert.ok(
      maintenance.some(
        ({ error }) => error instanceof Error && error.message === diagnostic,
      ),
      "maintenance failure must be reported",
    );
    if (failure !== "list")
      assert.equal(
        await fs.stat(another.entry),
        undefined,
        "cleanup must continue after a victim fails",
      );
    if (failure !== "release") {
      assert.equal(await fs.stat(active.lock), undefined);
      assert.equal((await builder.build(request)).cacheHit, true);
    }
  });
}

test("retention protects the active entry and every locked entry", async () => {
  const fixture = baselineFixture();
  const commits = ["a", "b", "c", "d", "e"].map((letter) => letter.repeat(40));
  for (const commit of commits.slice(0, 4)) {
    await fixture.builder.build({ ...fixture.request, commit });
    fixture.clock.time++;
  }
  const locked = cacheLayout("/repo", commits[1]!);
  fixture.fs.put(locked.lock, "regular", Buffer.from('{"pid":42}'));
  const builder = new CachedBaselineBuilder(
    fixture.fs,
    fixture.runner,
    fixture.clock,
    fixture.reporter,
    { ...fixture.options, retainedCount: 1 },
  );
  await builder.build({ ...fixture.request, commit: commits[4]! });
  assert.ok(await fixture.fs.stat(locked.output));
  assert.ok(await fixture.fs.stat(cacheLayout("/repo", commits[4]!).output));
  assert.equal(
    await fixture.fs.stat(cacheLayout("/repo", commits[2]!).entry),
    undefined,
  );
});

for (const failure of ["release", "partial-remove", "both"] as const) {
  test(`cleanup ${failure} diagnostics preserve the original failed command`, async (t) => {
    const { fs, request, runner, builder, maintenance } = baselineFixture();
    const layout = cacheLayout(request.repoRoot, request.commit);
    const run = runner.run;
    let commandFailed = false;
    runner.run = async (command) => {
      if (command.argv[0] === "git") return run(command);
      commandFailed = true;
      return {
        ...success,
        exitCode: 17,
        output: "Build failed\nMissing dependency\n",
      };
    };
    const remove = fs.remove.bind(fs);
    let releaseAttempted = false;
    t.mock.method(fs, "remove", async (file: string) => {
      if (file === layout.lock) {
        releaseAttempted = true;
        if (failure !== "partial-remove") throw new Error("release failed");
      }
      if (commandFailed && file === layout.source && failure !== "release")
        throw new Error("partial removal failed");
      await remove(file);
    });
    await assert.rejects(builder.build(request), {
      code: "baseline-command-failed",
      commandIndex: 0,
      argv: request.commands[0],
      exitCode: 17,
      signal: null,
      outputLines: ["Build failed", "Missing dependency"],
    });
    if (failure !== "partial-remove")
      assert.ok(
        maintenance.some(
          ({ entry, error }) =>
            entry === layout.lock &&
            error instanceof Error &&
            error.message === "release failed",
        ),
      );
    if (failure !== "release")
      assert.ok(
        maintenance.some(
          ({ entry, error }) =>
            entry === layout.entry &&
            error instanceof Error &&
            error.message === "partial removal failed",
        ),
      );
    assert.equal(releaseAttempted, true);
    assert.equal(await fs.stat(layout.marker), undefined);
    if (failure === "partial-remove")
      assert.equal(await fs.stat(layout.lock), undefined);
  });
}
