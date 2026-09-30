import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test, { type TestContext } from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import type { ServeReporter, WatchReport } from "../dist/server/reporter.js";
import { serve, type RunningServe } from "../dist/server/serve.js";

import {
  createFixture,
  removeFixture,
  type TestFixture,
  validEntrySource,
} from "./helpers/fixture.js";
import {
  FakeConfigLoader,
  FakeOutputStore,
  FakeSupervisor,
  FakeSupervisorFactory,
  FakeWatcherFactory,
  UnusedServerFactory,
} from "./helpers/watch_config.js";

test("an accepted rebuild keeps success when restart recovery reports a failure", async (t) => {
  const harness = await startWatched(t);

  await fs.writeFile(harness.fixture.entryPath, "export const broken = ;\n");
  harness.running.rebuild?.();
  await waitFor(() => harness.reporter.failures.length === 1);
  await waitFor(() => latestStatus(harness).updating === false);
  assert.notEqual(latestStatus(harness).failure, null);

  const restartError = new Error("accepted rebuild delivery failed");
  harness.supervisor.restartErrors.push(restartError);
  await fs.writeFile(
    harness.fixture.entryPath,
    validEntrySource({ firstTitle: "Accepted replacement" }),
  );
  harness.running.rebuild?.();
  await waitFor(() => harness.reporter.failures.length === 2);
  await waitFor(() => latestStatus(harness).updating === false);

  assert.equal(harness.reporter.failures[1]?.error, restartError);
  assert.equal(
    harness.reporter.failures.filter(({ error }) => error === restartError)
      .length,
    1,
  );
  assert.equal(harness.supervisor.restarts, 1);
  assert.equal(harness.supervisor.starts, 2);
  assert.equal(latestStatus(harness).failure, null);
  assert.equal(
    harness.supervisor.rebuildStatuses.some(
      ({ failure }) => failure?.detail === restartError.message,
    ),
    false,
  );
});

test("an accepted reconfigure keeps success when restart recovery reports a failure", async (t) => {
  const harness = await startWatched(t, (initial) => ({
    ...initial,
    watch: {
      debounceMs: 0,
      rules: [{ action: "reload", paths: ["extra.css"] }],
    },
  }));
  const restartError = new Error("accepted reconfigure delivery failed");
  harness.supervisor.restartErrors.push(restartError);

  harness.watchers.watchers[0]?.change(harness.initial.configPath);
  await waitFor(() => harness.reporter.failures.length === 1);
  await waitFor(() => latestStatus(harness).updating === false);

  assert.equal(harness.reporter.failures[0]?.error, restartError);
  assert.equal(harness.supervisor.restarts, 1);
  assert.equal(harness.supervisor.starts, 2);
  assert.equal(latestStatus(harness).failure, null);
  assertNoFailureDetail(harness, restartError);
});

test("an accepted reconfigure keeps success when the previous watcher cannot close", async (t) => {
  const harness = await startWatched(t, (initial) => ({
    ...initial,
    watch: {
      debounceMs: 0,
      rules: [{ action: "reload", paths: ["next.css"] }],
    },
  }));
  const closeError = new Error("previous watcher delivery failed");
  const previous = harness.watchers.watchers[0];
  assert.ok(previous);
  previous.closeError = closeError;

  previous.change(harness.initial.configPath);
  await waitFor(() => harness.reporter.failures.length === 1);
  await waitFor(() => latestStatus(harness).updating === false);

  assert.equal(harness.reporter.failures[0]?.error, closeError);
  assert.equal(previous.closeAttempts, 1);
  assert.equal(harness.supervisor.restarts, 1);
  assert.equal(latestStatus(harness).failure, null);
  assertNoFailureDetail(harness, closeError);
});

test("a rebuild that switches to reconfigure keeps an accepted delivery failure out of status", async (t) => {
  const fixture = await createFixture();
  const helper = path.join(fixture.mockupsDir, "document.ts");
  const nextHelper = path.join(fixture.mockupsDir, "next.ts");
  await fs.writeFile(helper, 'export const title = "Document";');
  await fs.appendFile(
    fixture.entryPath,
    '\nimport { title } from "../mockups/document.ts"; mockups[0].title = title;',
  );
  const harness = await startExistingFixture(t, fixture);
  const restartError = new Error("reconfigured rebuild delivery failed");
  harness.supervisor.restartErrors.push(restartError);

  await fs.writeFile(nextHelper, 'export const title = "Next";');
  await fs.writeFile(helper, 'export { title } from "./next.ts";');
  harness.watchers.watchers[0]?.change(helper);
  await waitFor(() => harness.reporter.failures.length === 1);
  await waitFor(() => latestStatus(harness).updating === false);

  assert.equal(harness.reporter.failures[0]?.error, restartError);
  assert.equal(harness.watchers.watchers.length, 2);
  assert.equal(harness.supervisor.starts, 2);
  assert.equal(latestStatus(harness).failure, null);
  assertNoFailureDetail(harness, restartError);
});

interface Harness {
  readonly fixture: TestFixture;
  readonly initial: ResolvedConfig;
  readonly reporter: RecordingReporter;
  readonly running: RunningServe;
  readonly supervisor: FakeSupervisor;
  readonly watchers: FakeWatcherFactory;
}

async function startWatched(
  t: TestContext,
  nextConfig: (initial: ResolvedConfig) => ResolvedConfig = (value) => value,
): Promise<Harness> {
  return startExistingFixture(t, await createFixture(), nextConfig);
}

async function startExistingFixture(
  t: TestContext,
  fixture: TestFixture,
  nextConfig: (initial: ResolvedConfig) => ResolvedConfig = (value) => value,
): Promise<Harness> {
  t.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const initial = {
    ...loaded,
    watch: { ...loaded.watch, debounceMs: 0 },
  };
  const supervisor = new FakeSupervisor();
  const watchers = new FakeWatcherFactory();
  const reporter = new RecordingReporter();
  const outputStore = new FakeOutputStore();
  const running = await serve(
    initial,
    { port: 0, watch: true },
    {
      configLoader: new FakeConfigLoader(nextConfig(initial)),
      outputStore,
      processSupervisorFactory: new FakeSupervisorFactory(supervisor),
      reporter,
      serverFactory: new UnusedServerFactory(),
      watcherFactory: watchers,
    },
  );
  fixture.beforeRemove(() => running.close());
  await waitFor(() => outputStore.configs.length === 1);
  return { fixture, initial, reporter, running, supervisor, watchers };
}

function latestStatus(harness: Harness) {
  const status = harness.supervisor.rebuildStatuses.at(-1);
  assert.ok(status);
  return status;
}

function assertNoFailureDetail(harness: Harness, error: Error): void {
  assert.equal(
    harness.supervisor.rebuildStatuses.some(
      ({ failure }) => failure?.detail === error.message,
    ),
    false,
  );
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("watched condition did not become true");
}

class RecordingReporter implements ServeReporter {
  readonly failures: Array<{ error: unknown; report: WatchReport }> = [];

  baselinePreparing() {}
  baselineReady() {}
  catalogueReady() {}
  changesReady() {}
  changesUnavailable() {}
  gitReferenceRefresh() {}
  runtimeDiagnostic() {}
  serveReady() {}
  watchFinished() {}
  watchStarted() {}

  watchFailed(report: WatchReport, error: unknown): void {
    this.failures.push({ error, report });
  }
}
