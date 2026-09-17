import assert from "node:assert/strict";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import type { GeneratedOutputStore } from "../dist/build/output_store.js";
import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
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

test(
  "shutdown during background output closes the accepted watcher without another restart",
  { timeout: 15000 },
  async (context) => {
    const fixture = await createFixture();
    context.after(() => removeFixture(fixture));
    const loaded = await loadConfig(fixture.root);
    const config: ResolvedConfig = {
      ...loaded,
      watch: { ...loaded.watch, debounceMs: 0 },
    };
    const output = new BlockingOutputStore();
    const watchers = new FakeWatcherFactory();
    const supervisor = new FakeSupervisor();
    const running = await serve(
      config,
      { port: 0, watch: true },
      {
        configLoader: { load: async () => config },
        outputStore: output,
        processSupervisorFactory: new FakeSupervisorFactory(supervisor),
        serverFactory: new UnusedServerFactory(),
        watcherFactory: watchers,
      },
    );

    context.after(() => running.close());
    await output.initialWritten;
    watchers.watchers[0]?.change(config.configPath);
    await output.candidateStarted;
    const closing = running.close();
    output.releaseCandidate();
    await closing;

    assert.equal(watchers.watchers.length, 2);
    assert.equal(watchers.watchers[0]?.closed, true);
    assert.equal(watchers.watchers[1]?.closed, true);
    assert.equal(supervisor.restarts, 1);
    assert.equal(supervisor.closed, true);
  },
);

test("shutdown cancels replacement watcher readiness", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const config: ResolvedConfig = {
    ...loaded,
    watch: { ...loaded.watch, debounceMs: 0 },
  };
  const watchers = new FakeWatcherFactory(true);
  const supervisor = new FakeSupervisor();
  const running = await serve(
    config,
    { port: 0, watch: true },
    {
      configLoader: { load: async () => config },
      outputStore: new BlockingOutputStore(),
      processSupervisorFactory: new FakeSupervisorFactory(supervisor),
      serverFactory: new UnusedServerFactory(),
      watcherFactory: watchers,
    },
  );

  watchers.watchers[0]?.change(config.configPath);
  const replacement = await watchers.replacementCreated;
  await replacement.readyStarted;
  await completesWithin(running.close());

  assert.equal(watchers.watchers[0]?.closed, true);
  assert.equal(replacement.closed, true);
  assert.equal(supervisor.restarts, 0);
  assert.equal(supervisor.closed, true);
});

class BlockingOutputStore implements GeneratedOutputStore {
  private writes = 0;
  private release: (() => void) | undefined;
  private markCandidateStarted: () => void = () => undefined;
  private markInitialWritten: () => void = () => undefined;
  readonly initialWritten = new Promise<void>((resolve) => {
    this.markInitialWritten = resolve;
  });
  readonly candidateStarted = new Promise<void>((resolve) => {
    this.markCandidateStarted = resolve;
  });

  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    _config: ResolvedConfig,
  ): Promise<void> {
    this.writes += 1;
    if (this.writes === 1) {
      this.markInitialWritten();
      return;
    }
    this.markCandidateStarted();
    await new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  releaseCandidate(): void {
    this.release?.();
  }
}

class FakeWatcherFactory implements ConsumerWatcherFactory {
  private markReplacementCreated: (watcher: FakeWatcher) => void = () =>
    undefined;
  readonly watchers: FakeWatcher[] = [];
  readonly replacementCreated = new Promise<FakeWatcher>((resolve) => {
    this.markReplacementCreated = resolve;
  });

  constructor(private readonly blockReplacement = false) {}

  create(_targets: readonly string[]): ConsumerWatcher {
    const watcher = new FakeWatcher(
      this.blockReplacement && this.watchers.length > 0,
    );
    if (this.watchers.length > 0) this.markReplacementCreated(watcher);
    this.watchers.push(watcher);
    return watcher;
  }
}

class FakeWatcher implements ConsumerWatcher {
  closed = false;
  private markReadyStarted: () => void = () => undefined;
  private changeCallback: ((candidate: string) => void) | undefined;
  readonly readyStarted = new Promise<void>((resolve) => {
    this.markReadyStarted = resolve;
  });

  constructor(private readonly blockReady = false) {}

  async close(): Promise<void> {
    this.closed = true;
  }

  onChange(callback: (candidate: string) => void): void {
    this.changeCallback = callback;
  }

  onError(_callback: (error: Error) => void): void {}

  async ready(): Promise<void> {
    this.markReadyStarted();
    if (this.blockReady) await new Promise<void>(() => undefined);
  }

  change(candidate: string): void {
    this.changeCallback?.(candidate);
  }
}

class FakeSupervisorFactory implements ProcessSupervisorFactory {
  constructor(private readonly supervisor: ProcessSupervisor) {}

  create(
    _binPath: string,
    _baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    return this.supervisor;
  }
}

class FakeSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  closed = false;
  restarts = 0;

  async close(): Promise<void> {
    this.closed = true;
  }

  notifyUpdate(): void {}

  onUnexpectedExit(_callback: (error: Error) => void): void {}

  async restart(): Promise<number> {
    this.restarts += 1;
    return 48123;
  }

  async start(): Promise<number> {
    return 48123;
  }
}

class UnusedServerFactory implements CatalogueServerFactory {
  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    throw new Error("watched Serve must not start an in-process server");
  }
}

async function completesWithin(operation: Promise<void>): Promise<void> {
  let handle: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      operation,
      new Promise<void>((_resolve, reject) => {
        handle = setTimeout(
          () => reject(new Error("watched shutdown timed out")),
          1_000,
        );
      }),
    ]);
  } finally {
    if (handle) clearTimeout(handle);
  }
}
