import assert from "node:assert/strict";
import test from "node:test";

import { BuildWarningSink } from "../dist/build/warning_sink.js";
import type { BuildWarning } from "../dist/build/warnings.js";
import { scopedWatchWarnings } from "../dist/server/watch_warning_scopes.js";

const warning = (
  code: BuildWarning["code"],
  context: string[],
): BuildWarning => ({
  code,
  context,
  message: `${code}:${context.join(":")}`,
});

test("warnings deduplicate across phases, sort before readiness and repeat only after reset", () => {
  const emitted: string[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item.message));
  sink.add(warning("removed-shared-impact", ["/repo/config.ts"]));
  sink.add(warning("removed-dependencies", ["home"]));
  sink.add(warning("removed-dependencies", ["home"]));
  sink.flush();
  assert.deepEqual(emitted, [
    "removed-dependencies:home",
    "removed-shared-impact:/repo/config.ts",
  ]);
  sink.add(warning("removed-dependencies", ["home"]));
  sink.add(
    warning("ignored-stylesheet-resource-owner", [
      "home.mobile.html",
      "/repo/action.css",
    ]),
  );
  assert.deepEqual(emitted, [
    "removed-dependencies:home",
    "removed-shared-impact:/repo/config.ts",
    "ignored-stylesheet-resource-owner:home.mobile.html:/repo/action.css",
  ]);
  sink.reset();
  sink.add(warning("removed-dependencies", ["home"]));
  sink.flush();
  assert.deepEqual(emitted, [
    "removed-dependencies:home",
    "removed-shared-impact:/repo/config.ts",
    "ignored-stylesheet-resource-owner:home.mobile.html:/repo/action.css",
    "removed-dependencies:home",
  ]);
});

test("a new attempt discards queued and late old warnings without relabelling them", () => {
  const emitted: BuildWarning[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item));
  const oldGeneration = sink.generation;
  const oldProducer = sink.forGeneration();
  const item = warning("removed-dependencies", ["home"]);
  oldProducer(item);
  sink.reset();
  assert.match(sink.generation, /^[a-f0-9]{32}$/);
  assert.notEqual(sink.generation, oldGeneration);
  oldProducer(warning("removed-dependencies", ["late"]));
  sink.flush();
  assert.deepEqual(emitted, []);
  sink.forGeneration()(item);
  sink.addGeneration({ generation: sink.generation, warning: item });
  assert.deepEqual(emitted, [item]);
});

test("failed actions flush only their own warnings and never restore the old scope", async () => {
  const emitted: string[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item.message));
  const oldProducer = sink.forGeneration();
  let failedProducer = oldProducer;
  const run = scopedWatchWarnings(async () => {
    failedProducer = sink.forGeneration();
    failedProducer(warning("removed-dependencies", ["candidate"]));
    oldProducer(warning("removed-dependencies", ["old"]));
    throw new Error("candidate failed");
  }, sink);
  await assert.rejects(run("rebuild"), /candidate failed/);
  emitted.push("failed");
  oldProducer(warning("removed-dependencies", ["late-old"]));
  failedProducer(warning("removed-dependencies", ["after-failure"]));
  assert.deepEqual(emitted, [
    "removed-dependencies:candidate",
    "failed",
    "removed-dependencies:after-failure",
  ]);
});

test("reload, restart and Git refresh retain generation and warning identities", async () => {
  const emitted: BuildWarning[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item));
  const generation = sink.generation;
  const item = warning("removed-dependencies", ["home"]);
  const run = scopedWatchWarnings(async () => sink.forGeneration()(item), sink);
  for (const action of ["reload", "restart", "evidence"] as const)
    await run(action);
  assert.equal(sink.generation, generation);
  assert.deepEqual(emitted, [item]);
  await run("rebuild");
  assert.deepEqual(emitted, [item, item]);
});
