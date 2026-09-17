import assert from "node:assert/strict";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import type { GeneratedOutputStore } from "../dist/build/output_store.js";
import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import type { CatalogueChangeClassifier } from "../dist/server/component_changes.js";
import type { CatalogueServerFactory } from "../dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../dist/server/http_types.js";
import { serve } from "../dist/server/serve.js";
import type {
  ProcessSupervisor,
  ProcessSupervisorFactory,
} from "../dist/server/supervisor.js";
import type {
  ConsumerWatcher,
  ConsumerWatcherFactory,
} from "../dist/server/watcher.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("watched startup attaches the watcher before the initial output write", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const events: string[] = [];
  const watcher = new FakeWatcher(events);
  const running = await serve(
    config,
    { base: "origin/main", port: 0, watch: true },
    dependencies(events, watcher),
  );
  context.after(() => running.close());

  assert.equal(events.includes("output:write"), false);
  await waitForEvent(events, "output:write");
  assert.ok(events.indexOf("watcher:create") < events.indexOf("output:write"));
  assert.ok(events.indexOf("watcher:ready") < events.indexOf("output:write"));
});

test("watcher readiness failure closes the watcher", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const events: string[] = [];
  const watcher = new FakeWatcher(events, new Error("watcher failed"));

  await assert.rejects(
    () =>
      serve(
        config,
        { base: "origin/main", port: 0, watch: true },
        dependencies(events, watcher),
      ),
    /watcher failed/,
  );
  assert.equal(watcher.closed, true);
});

test("watched startup does not await repository classification", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const events: string[] = [];
  let finish: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const classifier: CatalogueChangeClassifier = {
    async read(_config, manifest) {
      events.push("classification:start");
      await pending;
      return { baseline: manifest, changedRoutes: ["screens/home.html"] };
    },
  };
  const running = await serve(
    config,
    { base: "origin/main", port: 0, watch: true },
    dependencies(events, new FakeWatcher(events), classifier),
  );
  context.after(() => running.close());

  await waitForEvent(events, "classification:start");
  assert.ok(
    events.indexOf("supervisor:start") < events.indexOf("classification:start"),
  );
  assert.equal(events.includes("supervisor:update"), false);
  finish();
  await waitForEvent(events, "supervisor:update");
});

test("watched shutdown cancels background repository classification", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const events: string[] = [];
  let classificationSignal: AbortSignal | undefined;
  const classifier: CatalogueChangeClassifier = {
    async read(_config, manifest, _base, signal) {
      classificationSignal = signal;
      events.push("classification:start");
      await new Promise<void>((resolve) =>
        signal?.addEventListener("abort", () => resolve(), { once: true }),
      );
      return { baseline: manifest };
    },
  };
  const running = await serve(
    config,
    { base: "origin/main", port: 0, watch: true },
    dependencies(events, new FakeWatcher(events), classifier),
  );

  context.after(() => running.close());
  await waitForEvent(events, "classification:start");
  await running.close();

  assert.equal(classificationSignal?.aborted, true);
  assert.equal(events.includes("supervisor:update"), false);
});

function dependencies(
  events: string[],
  watcher: FakeWatcher,
  changeClassifier?: CatalogueChangeClassifier,
) {
  return {
    ...(changeClassifier ? { changeClassifier } : {}),
    configLoader: new FileSystemConfigLoader(),
    outputStore: new FakeOutputStore(events),
    processSupervisorFactory: new FakeSupervisorFactory(events),
    serverFactory: new UnusedServerFactory(),
    watcherFactory: new FakeWatcherFactory(events, watcher),
  };
}

class FakeOutputStore implements GeneratedOutputStore {
  constructor(private readonly events: string[]) {}

  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    _config: ResolvedConfig,
  ): Promise<void> {
    this.events.push("output:write");
  }
}

class FakeWatcherFactory implements ConsumerWatcherFactory {
  constructor(
    private readonly events: string[],
    private readonly watcher: ConsumerWatcher,
  ) {}

  create(_targets: readonly string[]): ConsumerWatcher {
    this.events.push("watcher:create");
    return this.watcher;
  }
}

class FakeWatcher implements ConsumerWatcher {
  closed = false;

  constructor(
    private readonly events: string[],
    private readonly failure?: Error,
  ) {}

  async close(): Promise<void> {
    this.closed = true;
    this.events.push("watcher:close");
  }

  onChange(_callback: (path: string) => void): void {}

  onError(_callback: (error: Error) => void): void {}

  async ready(): Promise<void> {
    this.events.push("watcher:ready");
    if (this.failure) throw this.failure;
  }
}

class FakeSupervisorFactory implements ProcessSupervisorFactory {
  constructor(private readonly events: string[]) {}

  create(
    _binPath: string,
    _baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    this.events.push("supervisor:create");
    return new FakeSupervisor(this.events);
  }
}

class FakeSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  constructor(private readonly events: string[]) {}

  async close(): Promise<void> {
    this.events.push("supervisor:close");
  }

  notifyUpdate(): void {
    this.events.push("supervisor:update");
  }

  onUnexpectedExit(_callback: (error: Error) => void): void {}

  async restart(): Promise<number> {
    return 43123;
  }

  async start(): Promise<number> {
    this.events.push("supervisor:start");
    return 43123;
  }
}

async function waitForEvent(events: readonly string[], expected: string) {
  for (let attempt = 0; attempt < 600; attempt += 1) {
    if (events.includes(expected)) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`missing event: ${expected}`);
}

class UnusedServerFactory implements CatalogueServerFactory {
  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    throw new Error("watched serve must not use the in-process server factory");
  }
}
