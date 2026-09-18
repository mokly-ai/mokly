import assert from "node:assert/strict";
import test from "node:test";

import type { ManifestV5 } from "@mokly/viewer/data";

import { FileSystemGeneratedOutputStore } from "../dist/build/output_store.js";
import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import type { ChildHandle } from "../dist/server/child_process.js";
import { NodeCatalogueServerFactory } from "../dist/server/factory.js";
import type { ServeReporter, WatchReport } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";
import {
  NodeProcessSupervisorFactory,
  ReadyProcessSupervisor,
} from "../dist/server/supervisor.js";
import type { ChildCommand } from "../dist/server/update_messages.js";
import { parseChildDiagnosticMessage } from "../dist/server/update_messages.js";
import {
  WatchActionQueue,
  WatchDebouncer,
  type DebounceClock,
} from "../dist/server/watch_events.js";
import { ChokidarWatcherFactory } from "../dist/server/watcher.js";

import { nodeBaselineBuilder } from "./helpers/baseline_builders.js";
import { derivedFixture } from "./helpers/derived_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

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

test("the supervisor forwards validated child diagnostics", async () => {
  const child = new ReportingChild();
  const supervisor = new ReadyProcessSupervisor({ spawn: () => child }, [], 0);
  const diagnostics: string[] = [];
  supervisor.onDiagnostic(diagnostics.push.bind(diagnostics));
  const started = supervisor.start();
  child.emit({ type: "diagnostic", message: "before ready" });
  child.emit({ type: "diagnostic", message: 42 });
  child.emit({ type: "ready", port: 48123 });
  assert.equal(await started, 48123);
  child.emit({ type: "diagnostic", message: "after ready" });
  assert.deepEqual(diagnostics, ["before ready", "after ready"]);
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
    t.after(() => running.close());
    await reporter.complete;
    assert.deepEqual(
      reporter.events.map((event) => event.split(":")[0]),
      ["catalogue", "baseline-preparing", "baseline-ready", "changes-ready"],
    );
    assert.match(reporter.events[0]!, /screen=2/);
    assert.match(reporter.events[2]!, /rebuilt/);
  },
);

test("the watched RunningServe rebuild hook uses the serialized queue", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const reporter = new RecordingReporter();
  const running = await serve(
    await loadConfig(fixture.root),
    { port: 0, watch: true },
    { reporter },
  );
  t.after(() => running.close());
  assert.ok(running.rebuild);
  running.rebuild();
  for (let attempt = 0; attempt < 400; attempt++) {
    if (reporter.events.includes("watch-finished:rebuild")) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`Manual rebuild did not settle: ${reporter.events.join(", ")}`);
});

class FakeClock implements DebounceClock {
  private callback: (() => void) | undefined;
  private readonly handle = {} as ReturnType<typeof setTimeout>;
  clear(_handle: ReturnType<typeof setTimeout>): void {
    this.callback = undefined;
  }
  schedule(
    callback: () => void,
    _milliseconds: number,
  ): ReturnType<typeof setTimeout> {
    this.callback = callback;
    return this.handle;
  }
  flush(): void {
    const callback = this.callback;
    this.callback = undefined;
    callback?.();
  }
}

class RecordingReporter implements ServeReporter {
  readonly events: string[] = [];
  readonly complete: Promise<void>;
  private resolve: () => void = () => undefined;

  constructor() {
    this.complete = new Promise((resolve) => {
      this.resolve = resolve;
    });
  }

  baselinePreparing(base: string): void {
    this.events.push(`baseline-preparing:${base}`);
  }
  baselineReady(commit: string, cacheHit: boolean): void {
    this.events.push(
      `baseline-ready:${commit}:${cacheHit ? "reused" : "rebuilt"}`,
    );
  }
  catalogueReady(manifest: ManifestV5): void {
    const screens = manifest.entries.filter(
      (entry) => entry.kind === "screen",
    ).length;
    this.events.push(`catalogue:screen=${screens}`);
  }
  changesReady(changed: number): void {
    this.events.push(`changes-ready:${changed}`);
    this.resolve();
  }
  changesUnavailable(): void {
    this.events.push("changes-unavailable");
    this.resolve();
  }
  gitReferenceRefresh(_base: string): void {}
  runtimeDiagnostic(_error: unknown): void {}
  serveReady(): void {}
  watchFailed(_report: WatchReport, _error: unknown): void {}
  watchFinished(report: WatchReport): void {
    this.events.push(`watch-finished:${report.action}`);
  }
  watchStarted(report: WatchReport): void {
    this.events.push(`watch-started:${report.action}`);
  }
}

class ReportingChild implements ChildHandle {
  readonly listeners: Array<(value: unknown) => void> = [];
  readonly exits: Array<(code: number | null) => void> = [];
  forceKill(): void {}
  onDisconnect(): void {}
  onError(): void {}
  onExit(callback: (code: number | null) => void): void {
    this.exits.push(callback);
  }
  onMessage(callback: (value: unknown) => void): void {
    this.listeners.push(callback);
  }
  send(_message: ChildCommand): void {}
  terminate(): void {}
  emit(value: unknown): void {
    for (const listener of this.listeners) listener(value);
  }
  exit(): void {
    for (const listener of this.exits.splice(0)) listener(0);
  }
}
