import assert from "node:assert/strict";
import test from "node:test";

import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import { NodeCatalogueServerFactory } from "../dist/server/factory.js";
import { serve } from "../dist/server/serve.js";
import {
  NodeProcessSupervisorFactory,
  ReadyProcessSupervisor,
} from "../dist/server/supervisor.js";
import {
  parseChildDiagnosticMessage,
  parseChildWarningMessage,
} from "../dist/server/update_messages.js";
import {
  WatchActionQueue,
  WatchDebouncer,
} from "../dist/server/watch_events.js";
import { ChokidarWatcherFactory } from "../dist/server/watcher.js";

import { nodeBaselineBuilder } from "./helpers/baseline_builders.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  FakeClock,
  RecordingReporter,
  ReportingChild,
} from "./server_reporting_fixture.js";

test("debounced and queued watch work retains every candidate path", async () => {
  const clock = new FakeClock();
  const debounced: Array<{ action: string; paths: readonly string[] }> = [];
  const debouncer = new WatchDebouncer(
    75,
    (action, paths) => debounced.push({ action, paths }),
    clock,
  );
  debouncer.notify("reload", "/repo/theme.css");
  debouncer.notify("rebuild", "/repo/home.mockup.tsx");
  debouncer.notify("reload", "/repo/tokens.css");
  clock.flush();
  assert.deepEqual(debounced, [
    {
      action: "rebuild",
      paths: ["/repo/theme.css", "/repo/home.mockup.tsx", "/repo/tokens.css"],
    },
  ]);

  const processed: Array<{ action: string; paths: readonly string[] }> = [];
  let release: (() => void) | undefined;
  const first = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queue = new WatchActionQueue(
    async (action, paths) => {
      processed.push({ action, paths });
      if (processed.length === 1) await first;
    },
    (error) => assert.fail(String(error)),
  );
  queue.notify("reload", ["first.css"]);
  await new Promise((resolve) => setImmediate(resolve));
  queue.notify("restart", ["server.ts"]);
  queue.notify("rebuild", ["home.tsx", "details.tsx"]);
  release?.();
  await queue.settled();
  assert.deepEqual(processed, [
    { action: "reload", paths: ["first.css"] },
    {
      action: "rebuild",
      paths: ["server.ts", "home.tsx", "details.tsx"],
    },
  ]);
});

test("child diagnostic IPC accepts only a bounded string message", () => {
  assert.deepEqual(
    parseChildDiagnosticMessage({ type: "diagnostic", message: "failed" }),
    { type: "diagnostic", message: "failed" },
  );
  for (const value of [
    { type: "diagnostic" },
    { type: "diagnostic", message: 1 },
    { type: "diagnostic", message: "" },
    { type: "diagnostic", message: "x".repeat(65_537) },
    { type: "update", message: "failed" },
  ])
    assert.equal(parseChildDiagnosticMessage(value), undefined);
});

test("child warning IPC accepts only bounded structured warnings", () => {
  const generation = "a".repeat(32);
  const warning = {
    code: "removed-dependencies",
    context: ["home"],
    message:
      'dependencies has been removed; ignoring it on entry "home". Delete the field.',
  };
  assert.deepEqual(
    parseChildWarningMessage({ type: "warning", generation, warning }),
    {
      type: "warning",
      generation,
      warning,
    },
  );
  for (const value of [
    { type: "warning" },
    { type: "warning", warning },
    ...[null, 1, "", "A".repeat(32), "a".repeat(31), "g".repeat(32)].map(
      (generation) => ({ type: "warning", generation, warning }),
    ),
    { type: "warning", generation, warning: { ...warning, code: "unknown" } },
    {
      type: "warning",
      generation,
      warning: { ...warning, context: ["home", "extra"] },
    },
    { type: "warning", generation, warning: { ...warning, context: [42] } },
    { type: "warning", generation, warning: { ...warning, message: "" } },
    {
      type: "warning",
      generation,
      warning: { ...warning, message: "x".repeat(65_537) },
    },
    { type: "diagnostic", warning },
  ])
    assert.equal(parseChildWarningMessage(value), undefined);
});

test("the supervisor forwards validated child diagnostics", async () => {
  const child = new ReportingChild();
  const supervisor = new ReadyProcessSupervisor({ spawn: () => child }, [], 0);
  const diagnostics: string[] = [];
  const warnings: string[] = [];
  supervisor.onDiagnostic(diagnostics.push.bind(diagnostics));
  supervisor.onWarning((event) =>
    warnings.push(`${event.generation}:${event.warning.message}`),
  );
  const started = supervisor.start();
  child.emit({ type: "diagnostic", message: "before ready" });
  child.emit({
    type: "warning",
    generation: "a".repeat(32),
    warning: {
      code: "removed-dependencies",
      context: ["home"],
      message: "before ready warning",
    },
  });
  child.emit({ type: "diagnostic", message: 42 });
  child.emit({ type: "ready", port: 48123 });
  assert.equal(await started, 48123);
  child.emit({ type: "diagnostic", message: "after ready" });
  child.emit({
    type: "warning",
    generation: "b".repeat(32),
    warning: {
      code: "removed-dependencies",
      context: ["home"],
      message: "after ready warning",
    },
  });
  assert.deepEqual(diagnostics, ["before ready", "after ready"]);
  assert.deepEqual(warnings, [
    `${"a".repeat(32)}:before ready warning`,
    `${"b".repeat(32)}:after ready warning`,
  ]);
  const closing = supervisor.close();
  child.exit();
  await closing;
});

test(
  "derived Serve reports catalogue, baseline, and Changes lifecycle events",
  { timeout: 30_000 },
  async (t) => {
    const fixture = await derivedFixture(t);
    const reporter = new RecordingReporter();
    const running = await serve(
      fixture.config,
      { port: 0, watch: false },
      {
        baselineBuilder: nodeBaselineBuilder(),
        configLoader: new FileSystemConfigLoader(),
        outputStore: new FileSystemGeneratedOutputStore(),
        processSupervisorFactory: new NodeProcessSupervisorFactory(),
        reporter,
        serverFactory: new NodeCatalogueServerFactory(),
        watcherFactory: new ChokidarWatcherFactory(),
      },
    );
    fixture.beforeRemove(() => running.close());
    await reporter.complete;
    assert.deepEqual(
      reporter.events.map((event) => event.split(":")[0]),
      ["catalogue", "baseline-preparing", "baseline-ready", "changes-ready"],
    );
    assert.match(reporter.events[0]!, /screen=2/);
    assert.match(reporter.events[2]!, /rebuilt/);
  },
);

test("screen-only Serve logs classifier failures and reports Changes unavailable", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reporter = new RecordingReporter();
  const running = await serve(
    await loadConfig(fixture.root),
    { port: 0, watch: false },
    {
      changeClassifier: {
        async read() {
          throw new Error("screen classifier failed");
        },
      },
      reporter,
    },
  );
  fixture.beforeRemove(() => running.close());
  await reporter.complete;

  assert.ok(
    reporter.events.some((event) =>
      event.includes("diagnostic:screen classifier failed"),
    ),
  );
  assert.ok(reporter.events.includes("changes-unavailable"));
});

test("the watched RunningServe rebuild hook uses the serialized queue", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reporter = new RecordingReporter();
  const running = await serve(
    await loadConfig(fixture.root),
    { port: 0, watch: true },
    { reporter },
  );
  fixture.beforeRemove(() => running.close());
  assert.ok(running.rebuild);
  running.rebuild();
  for (let attempt = 0; attempt < 400; attempt++) {
    if (reporter.events.includes("watch-finished:rebuild")) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Manual rebuild did not settle: ${reporter.events.join(", ")}`);
});
