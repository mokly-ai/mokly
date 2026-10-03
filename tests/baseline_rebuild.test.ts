import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { cacheLayout } from "../dist/baseline/cache_layout.js";
import { BaselineCommandError } from "../dist/baseline/errors.js";
import type { BaselineProgress } from "../dist/baseline/types.js";
import { isCancellation } from "../dist/errors.js";

import { baselineFixture, success } from "./helpers/baseline_fixture.js";

function code(value: unknown, expected: string): boolean {
  assert.equal((value as { code: string }).code, expected);
  return true;
}

test("baseline rebuild adopts once and a cache hit executes no commands", async () => {
  const { builder, request, calls, fs } = baselineFixture();
  const events: BaselineProgress[] = [];
  const first = await builder.build({
    ...request,
    onProgress: (event) => events.push(event),
  });
  assert.equal(first.cacheHit, false);
  assert.equal(first.marker.manifestVersion, 8);
  assert.deepEqual(first.marker.commands, request.commands);
  assert.equal(
    await fs.stat(path.join(path.dirname(first.outputDir), "source")),
    undefined,
  );
  assert.equal(
    await fs.stat(path.join(path.dirname(first.outputDir), "lock")),
    undefined,
  );
  assert.deepEqual(
    calls.map((call) => call.argv[0]),
    ["git", "git", "fixture-build"],
  );
  const second = await builder.build({
    ...request,
    onProgress: (event) => events.push(event),
  });
  assert.equal(second.cacheHit, true);
  assert.equal(calls.length, 3);
  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "complete", "complete"],
  );
  assert.deepEqual(calls[2]?.env, {
    PATH: "/bin",
    HOME: "/home/test",
    CI: "1",
    MOKLY_BASELINE_COMMIT: request.commit,
  });
  assert.deepEqual(calls[2]?.argv, request.commands[0]);
});

test("cancellation at the marker commit point completes and skips cleanup", async (t) => {
  const { builder, request, fs, calls } = baselineFixture();
  const layout = cacheLayout(request.repoRoot, request.commit);
  const controller = new AbortController();
  const write = fs.write.bind(fs);
  t.mock.method(fs, "write", async (file: string, bytes: Uint8Array) => {
    await write(file, bytes);
    if (file === layout.marker) controller.abort();
  });
  const list = fs.list.bind(fs);
  const cleanup = t.mock.method(fs, "list", async (directory: string) => {
    assert.notEqual(directory, layout.root, "cleanup ran after cancellation");
    return list(directory);
  });
  const events: BaselineProgress[] = [];
  const result = await builder.build({
    ...request,
    signal: controller.signal,
    onProgress: (event) => events.push(event),
  });
  assert.equal(result.cacheHit, false);
  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "complete"],
  );
  assert.ok(await fs.stat(layout.marker));
  assert.ok(await fs.stat(layout.output));
  assert.equal(await fs.stat(layout.lock), undefined);
  cleanup.mock.restore();
  assert.equal((await builder.build(request)).cacheHit, true);
  assert.equal(calls.length, 3);
});

test("concurrent baseline builders wait for the same completed output", async () => {
  const { builder, request, runner, clock, calls } = baselineFixture();
  const run = runner.run;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  runner.run = async (request) => {
    if (request.argv[0] === "fixture-build") await pending;
    return run(request);
  };
  clock.onSleep = release;
  const progress: BaselineProgress[][] = [[], []];
  const results = await Promise.all([
    builder.build({
      ...request,
      onProgress: (event) => progress[0]!.push(event),
    }),
    builder.build({
      ...request,
      onProgress: (event) => progress[1]!.push(event),
    }),
  ]);
  assert.deepEqual(results.map((result) => result.cacheHit).sort(), [
    false,
    true,
  ]);
  assert.equal(
    calls.filter((call) => call.argv[0] === "fixture-build").length,
    1,
  );
  const waiter = results.findIndex((result) => result.cacheHit);
  assert.deepEqual(
    progress[waiter]!.map((event) => event.type),
    ["complete"],
  );
});

test("a dead lock is reclaimed and an interrupted entry is rebuilt", async () => {
  const { builder, request, fs } = baselineFixture();
  const layout = cacheLayout(request.repoRoot, request.commit);
  fs.put(layout.entry, "directory");
  fs.put(layout.lock, "regular", Buffer.from('{"pid":9999,"startedAt":0}'));
  fs.put(layout.source, "directory");
  fs.put(path.join(layout.source, "partial"), "regular");
  fs.put(layout.marker, "regular", Buffer.from("{"));
  const result = await builder.build(request);
  assert.equal(result.cacheHit, false);
  assert.equal(await fs.stat(layout.source), undefined);
});

test("a live lock times out and cancellation never removes its holder's files", async () => {
  const fixture = baselineFixture();
  const layout = cacheLayout(fixture.request.repoRoot, fixture.request.commit);
  fixture.fs.put(layout.entry, "directory");
  fixture.fs.put(
    layout.lock,
    "regular",
    Buffer.from('{"pid":42,"startedAt":0}'),
  );
  fixture.fs.put(layout.source, "directory");
  await assert.rejects(fixture.builder.build(fixture.request), (error) =>
    code(error, "baseline-lock-timeout"),
  );
  assert.ok(await fixture.fs.stat(layout.source));
  const controller = new AbortController();
  fixture.clock.onSleep = () => controller.abort();
  await assert.rejects(
    fixture.builder.build({ ...fixture.request, signal: controller.signal }),
    (error) => {
      assert.equal(isCancellation(error), true);
      return code(error, "baseline-interrupted");
    },
  );
  assert.ok(await fixture.fs.stat(layout.lock));
});

test("command failure retains status, argv and only the last output lines", async () => {
  const { builder, request, runner, fs } = baselineFixture();
  const run = runner.run;
  runner.run = async (command) =>
    command.argv[0] === "git"
      ? run(command)
      : {
          ...success,
          exitCode: 17,
          output: Array.from(
            { length: 100 },
            (_, index) => `line ${index}`,
          ).join("\n"),
        };
  await assert.rejects(builder.build(request), (error) => {
    assert.ok(error instanceof BaselineCommandError);
    assert.equal(error.exitCode, 17);
    assert.equal(error.commandIndex, 0);
    assert.deepEqual(error.argv, request.commands[0]);
    assert.equal(error.outputLines.length, 40);
    assert.equal(error.outputLines.at(-1), "line 99");
    return true;
  });
  const layout = cacheLayout(request.repoRoot, request.commit);
  assert.equal(await fs.stat(layout.marker), undefined);
  assert.equal(await fs.stat(layout.source), undefined);
  assert.equal(await fs.stat(layout.lock), undefined);
});

test("aborted command removes partial output and emits a typed failure", async () => {
  const { builder, request, runner, fs } = baselineFixture();
  const controller = new AbortController();
  const run = runner.run;
  runner.run = async (command) => {
    const result = await run(command);
    if (command.argv[0] !== "git") controller.abort();
    return result;
  };
  const events: BaselineProgress[] = [];
  await assert.rejects(
    builder.build({
      ...request,
      signal: controller.signal,
      onProgress: (event) => events.push(event),
    }),
    (error) => {
      assert.equal(isCancellation(error), true);
      return code(error, "baseline-interrupted");
    },
  );
  assert.deepEqual(
    events.map((event) => event.type),
    ["start", "fail"],
  );
  const layout = cacheLayout(request.repoRoot, request.commit);
  assert.equal(await fs.stat(layout.marker), undefined);
  assert.equal(await fs.stat(layout.output), undefined);
  assert.equal(await fs.stat(layout.source), undefined);
});

test("different catalogue settings cannot reuse or erase a completed baseline", async () => {
  const { builder, request, fs } = baselineFixture();
  const first = await builder.build(request);
  const layout = cacheLayout(request.repoRoot, request.commit);
  fs.put(layout.lock, "regular", Buffer.from('{"pid":9999}'));
  await assert.rejects(
    builder.build({ ...request, mockupsPath: "another-catalogue" }),
    (error) => code(error, "baseline-output-invalid"),
  );
  assert.ok(await fs.stat(layout.marker));
  assert.ok(await fs.stat(first.outputDir));
});

for (const outcome of ["missing", "invalid", "symlink"] as const)
  test(`rebuilt output rejects a ${outcome} manifest`, async () => {
    const { builder, request, runner, fs } = baselineFixture();
    const run = runner.run;
    runner.run = async (command) => {
      const result = await run(command);
      if (command.argv[0] !== "git") {
        const file = path.join(
          command.cwd,
          "mockups/mokly-generated/mokly-manifest.json",
        );
        await fs.remove(file);
        if (outcome !== "missing")
          fs.put(
            file,
            outcome === "symlink" ? "symlink" : "regular",
            Buffer.from("{}"),
          );
      }
      return result;
    };
    await assert.rejects(builder.build(request), (error) =>
      code(error, "baseline-output-invalid"),
    );
    assert.equal(
      await fs.stat(cacheLayout(request.repoRoot, request.commit).marker),
      undefined,
    );
  });

test("history failures and unsafe cache ancestors never run consumer commands", async () => {
  const fixture = baselineFixture();
  fixture.runner.run = async () => ({
    ...success,
    exitCode: 1,
    output: "missing commit",
  });
  await assert.rejects(fixture.builder.build(fixture.request), {
    code: "baseline-history-unavailable",
  });
  fixture.fs.put("/repo/.mokly-cache", "symlink");
  await assert.rejects(fixture.builder.build(fixture.request), {
    code: "baseline-output-invalid",
  });
  await assert.rejects(
    fixture.builder.build({ ...fixture.request, commit: "../escape" }),
    { code: "baseline-history-unavailable" },
  );
});
