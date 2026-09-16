import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import type { Compilation } from "../dist/build/compile.js";
import type { GeneratedOutputStore } from "../dist/build/output_store.js";
import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import type { CatalogueServerFactory } from "../dist/server/factory.js";
import type {
  RunningServer,
  ServerOptions,
} from "../dist/server/http_types.js";
import { serve } from "../dist/server/serve.js";
import { restartWithRecovery } from "../dist/server/serve_lifecycle.js";
import {
  type ProcessSupervisor,
  type ProcessSupervisorFactory,
} from "../dist/server/supervisor.js";
import {
  NotificationGate,
  WatchActionQueue,
  WatchDebouncer,
  classifyWatchPath,
  type DebounceClock,
} from "../dist/server/watch_events.js";
import type {
  ConsumerWatcher,
  ConsumerWatcherFactory,
} from "../dist/server/watcher.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("notification gate preserves startup events", () => {
  const gate = new NotificationGate<string>();
  const received: string[] = [];
  gate.notify("first");
  gate.notify("second");
  gate.open((value) => received.push(value));
  gate.notify("third");
  assert.deepEqual(received, ["first", "second", "third"]);
});

test("debouncer emits only the highest-impact action", () => {
  const clock = new FakeClock();
  const actions: string[] = [];
  const debouncer = new WatchDebouncer(
    75,
    (action) => actions.push(action),
    clock,
  );
  debouncer.notify("reload");
  debouncer.notify("restart");
  debouncer.notify("rebuild");
  clock.flush();
  assert.deepEqual(actions, ["rebuild"]);
});

test("watch actions serialize and coalesce work received during a rebuild", async () => {
  const actions: string[] = [];
  let active = 0;
  let maxActive = 0;
  let releaseFirst: (() => void) | undefined;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  const errors: unknown[] = [];
  const queue = new WatchActionQueue(
    async (action) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      actions.push(action);
      if (actions.length === 1) await first;
      active -= 1;
    },
    (error) => errors.push(error),
  );
  queue.notify("reload");
  await new Promise((resolve) => setImmediate(resolve));
  queue.notify("restart");
  queue.notify("rebuild");
  releaseFirst?.();
  await queue.settled();
  assert.deepEqual(actions, ["reload", "rebuild"]);
  assert.equal(maxActive, 1);
  assert.deepEqual(errors, []);
  await queue.close();
});

test("watch classification is derived from consumer config", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  assert.equal(classifyWatchPath(fixture.entryPath, config), "rebuild");
  assert.equal(
    classifyWatchPath(path.join(fixture.root, "notes.md"), config),
    "ignore",
  );
  assert.equal(
    classifyWatchPath(path.join(fixture.mockupsDir, "generated.html"), config),
    "ignore",
  );
});

test("Serve orchestration accepts fake filesystem, server, and watcher boundaries", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const outputStore = new FakeOutputStore();
  const serverFactory = new FakeServerFactory();
  const running = await serve(
    config,
    { base: "origin/main", port: 0, watch: false },
    {
      configLoader: new FileSystemConfigLoader(),
      outputStore,
      processSupervisorFactory: new UnusedProcessSupervisorFactory(),
      serverFactory,
      watcherFactory: new UnusedWatcherFactory(),
    },
  );
  context.after(() => running.close());
  assert.equal(
    outputStore.writes,
    0,
    "startup must not await generated output",
  );
  assert.equal(serverFactory.starts, 1);
  assert.equal(running.port, 43210);
  for (let attempt = 0; outputStore.writes === 0 && attempt < 200; attempt++)
    await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(outputStore.writes, 1);
  await running.close();
  assert.equal(serverFactory.closed, true);
});

test("a failed restart restores a child and retains the original diagnostic", async () => {
  const supervisor = new RecoverableFakeSupervisor();
  await assert.rejects(() => restartWithRecovery(supervisor), /restart failed/);
  assert.equal(supervisor.restarts, 1);
  assert.equal(supervisor.starts, 1);
});

class FakeClock implements DebounceClock {
  private callback: (() => void) | undefined;
  private readonly handle = { fake: true } as unknown as ReturnType<
    typeof setTimeout
  >;

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

class FakeOutputStore implements GeneratedOutputStore {
  writes = 0;

  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    _config: ResolvedConfig,
  ): Promise<void> {
    this.writes += 1;
  }
}

class FakeServerFactory implements CatalogueServerFactory {
  closed = false;
  starts = 0;

  async start(
    _config: ResolvedConfig,
    _options: ServerOptions,
  ): Promise<RunningServer> {
    this.starts += 1;
    return {
      close: async () => {
        this.closed = true;
      },
      port: 43210,
      publishUpdate: () => undefined,
      replaceComponentRuntime: () => undefined,
      url: "http://127.0.0.1:43210",
    };
  }
}

class UnusedWatcherFactory implements ConsumerWatcherFactory {
  create(_targets: readonly string[]): ConsumerWatcher {
    throw new Error("no-watch Serve must not create a watcher");
  }
}

class UnusedProcessSupervisorFactory implements ProcessSupervisorFactory {
  create(
    _binPath: string,
    _baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    throw new Error("no-watch Serve must not create a process supervisor");
  }
}

class RecoverableFakeSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  restarts = 0;
  starts = 0;

  async close(): Promise<void> {}

  notifyUpdate(): void {}

  onUnexpectedExit(_callback: (error: Error) => void): void {}

  async restart(): Promise<number> {
    this.restarts += 1;
    throw new Error("restart failed");
  }

  async start(): Promise<number> {
    this.starts += 1;
    return 48123;
  }
}
