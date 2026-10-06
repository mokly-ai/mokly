import assert from "node:assert/strict";
import test from "node:test";

import type { BuildDiagnostic } from "../dist/build/build_warnings.js";
import { BuildWarningSink } from "../dist/build/warning_sink.js";
import {
  removedDependencies,
  removedSharedImpact,
  ignoredStylesheetResourceOwner,
} from "../dist/build/warnings.js";
import { scopedWatchWarnings } from "../dist/server/watch_warning_scopes.js";

const entry = removedDependencies("home");
const config = removedSharedImpact("/repo/config.ts");
const owner = ignoredStylesheetResourceOwner("home.mobile.html", "action.css");

test("warnings deduplicate across phases, sort before readiness and repeat only after reset", () => {
  const emitted: BuildDiagnostic[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item));
  sink.add(entry);
  sink.add(config);
  sink.add(entry);
  sink.complete([entry, config]);
  assert.deepEqual(emitted, [config, entry]);
  sink.add(entry);
  sink.add(owner);
  assert.deepEqual(emitted, [config, entry, owner]);
  sink.reset();
  sink.add(entry);
  sink.flush();
  assert.deepEqual(emitted, [config, entry, owner, entry]);
});

test("a new attempt discards queued and late old warnings without relabelling them", () => {
  const emitted: BuildDiagnostic[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item));
  const oldGeneration = sink.generation;
  const oldProducer = sink.forGeneration();
  oldProducer(entry);
  sink.reset();
  assert.match(sink.generation, /^[a-f0-9]{32}$/);
  assert.notEqual(sink.generation, oldGeneration);
  oldProducer(removedDependencies("late"));
  sink.flush();
  assert.deepEqual(emitted, []);
  sink.forGeneration()(entry);
  sink.addGeneration({ generation: sink.generation, warning: entry });
  assert.deepEqual(emitted, [entry]);
});

test("failed actions flush only their own warnings and never restore the old scope", async () => {
  const emitted: Array<BuildDiagnostic | string> = [];
  const sink = new BuildWarningSink((item) => emitted.push(item));
  const oldProducer = sink.forGeneration();
  let failedProducer = oldProducer;
  const candidate = removedDependencies("candidate");
  const after = removedDependencies("after-failure");
  const run = scopedWatchWarnings(async () => {
    failedProducer = sink.forGeneration();
    failedProducer(candidate);
    oldProducer(removedDependencies("old"));
    throw new Error("candidate failed");
  }, sink);
  await assert.rejects(run("rebuild"), /candidate failed/);
  emitted.push("failed");
  oldProducer(removedDependencies("late-old"));
  failedProducer(after);
  assert.deepEqual(emitted, [candidate, "failed", after]);
});

test("reload, restart and Git refresh retain generation and warning identities", async () => {
  const emitted: BuildDiagnostic[] = [];
  const sink = new BuildWarningSink((item) => emitted.push(item));
  const generation = sink.generation;
  sink.complete([entry]);
  const run = scopedWatchWarnings(
    async () => sink.forGeneration()(entry),
    sink,
  );
  for (const action of ["reload", "restart", "evidence"] as const)
    await run(action);
  assert.equal(sink.generation, generation);
  assert.deepEqual(emitted, [entry]);
  await run("rebuild");
  assert.deepEqual(emitted, [entry]);
  sink.complete([entry]);
  assert.deepEqual(emitted, [entry, entry]);
});
