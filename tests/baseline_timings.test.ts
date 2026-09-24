import assert from "node:assert/strict";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { loadConfig } from "../dist/config/load.js";
import {
  runWithTimings,
  type TimingEvent,
} from "../dist/diagnostics/timings.js";
import { prepareReviewRepository } from "../dist/review/prepare.js";

import { baselineFixture, success } from "./helpers/baseline_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

test("baseline timings separate cold preparation and cache reuse without consumer data", async () => {
  const { builder, request, calls } = baselineFixture();
  const events: TimingEvent[] = [];
  let clock = 0;
  await runWithTimings(
    true,
    "test",
    async () => {
      await builder.build(request);
      await builder.build(request);
    },
    { clock: () => ++clock, write: (event) => events.push(event) },
  );
  const ends = events.filter((event) => event.event === "end");
  const parents = ends.filter((event) => event.stage === "baseline");
  assert.deepEqual(
    parents.map((event) => event.cacheHit),
    [false, true],
  );
  assert.deepEqual(
    ends
      .filter((event) => event.parentId === parents[0]!.id)
      .map((event) => event.stage),
    ["baseline.extract", "baseline.command[0]", "baseline.adopt"],
  );
  assert.equal(
    ends.filter((event) => event.parentId === parents[1]!.id).length,
    0,
  );
  assert.ok(
    parents.every((event) => event.status === "ok" && event.durationMs! > 0),
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /fixture-build|touch escaped|\/repo|hidden/,
  );
  assert.deepEqual(calls[2]!.argv, request.commands[0]);
});

test("failed and interrupted commands close diagnostic spans without adopting output", async () => {
  for (const interrupted of [false, true]) {
    const { builder, request, runner } = baselineFixture();
    const controller = new AbortController();
    const run = runner.run;
    runner.run = async (command) => {
      if (command.argv[0] === "git") return run(command);
      if (interrupted) controller.abort();
      return { ...success, exitCode: 19, output: "private failure" };
    };
    const events: TimingEvent[] = [];
    await assert.rejects(
      runWithTimings(
        true,
        "test",
        () =>
          builder.build({
            ...request,
            signal: controller.signal,
          }),
        { write: (event) => events.push(event) },
      ),
      {
        code: interrupted ? "baseline-interrupted" : "baseline-command-failed",
      },
    );
    const ends = events.filter((event) => event.event === "end");
    assert.equal(
      ends.find((event) => event.stage === "baseline.command[0]")?.status,
      "error",
    );
    assert.equal(
      ends.find((event) => event.stage === "baseline")?.status,
      "error",
    );
    assert.ok(!ends.some((event) => event.stage === "baseline.adopt"));
    assert.doesNotMatch(JSON.stringify(events), /private failure/);
    assert.equal(
      events.filter((event) => event.event === "start").length,
      ends.length,
    );
  }
});

test("ordinary rebuilds produce no diagnostic events", async () => {
  const { builder, request } = baselineFixture();
  await runWithTimings(false, "test", () => builder.build(request), {
    clock() {
      throw new Error("disabled timing clock called");
    },
    write() {
      throw new Error("disabled timing sink called");
    },
  });
});

test("resolution timings capture pinned commits and missing history without private refs", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const manifest = (await compileCatalogue(config)).manifest;
  const commit = "a".repeat(40);
  const manifestPath = "mockups/.generated/mokly-manifest.json";
  const manifestHash = "b".repeat(40);
  const tree = [
    `100644 blob ${manifestHash}\t${manifestPath}\0`,
    ...manifest.generatedFiles.map(
      ({ path, blobHash }) =>
        `100644 blob ${blobHash}\tmockups/.generated/${path}\0`,
    ),
  ].join("");
  const events: TimingEvent[] = [];
  await runWithTimings(
    true,
    "test",
    async () => {
      const prepared = await prepareReviewRepository(config, "private-ref", {
        commit,
        runner: {
          async run(argv) {
            if (argv[0] === "rev-parse") return fixture.root;
            if (argv[0] === "ls-tree") return tree;
            assert.equal(argv[0], "show");
            return JSON.stringify(manifest);
          },
        },
      });
      assert.equal(prepared.commit, commit);
      await assert.rejects(
        prepareReviewRepository(config, "private-ref", {
          runner: {
            async run() {
              throw new Error("private missing history");
            },
          },
        }),
        { code: "baseline-history-unavailable" },
      );
    },
    { write: (event) => events.push(event) },
  );
  assert.deepEqual(
    events
      .filter((event) => event.event === "end")
      .map((event) => [event.stage, event.status]),
    [
      ["baseline.resolve", "ok"],
      ["baseline.resolve", "error"],
    ],
  );
  assert.doesNotMatch(
    JSON.stringify(events),
    /private-ref|private missing history/,
  );
});
