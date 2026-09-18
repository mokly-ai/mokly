import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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
import {
  classifyWatchPath,
  watchTargets,
} from "../dist/server/watch_events.js";
import type {
  ConsumerWatcher,
  ConsumerWatcherFactory,
} from "../dist/server/watcher.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("watched graphs add imported helpers and retain last-good inputs after failure", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const helper = path.join(fixture.mockupsDir, "document.ts");
  const nextHelper = path.join(fixture.mockupsDir, "next.ts");
  await fs.promises.writeFile(helper, 'export const title = "Document";');
  await fs.promises.appendFile(
    fixture.entryPath,
    '\nimport { title } from "../mockups/document.ts"; mockups[0].title = title;',
  );
  const loaded = await loadConfig(fixture.root);
  const initial = { ...loaded, watch: { ...loaded.watch, debounceMs: 0 } };
  const watchers = new FakeWatcherFactory();
  const output = new FakeOutputStore();
  const supervisor = new FakeSupervisor();
  const running = await serve(
    initial,
    { port: 0, watch: true },
    {
      configLoader: new FakeConfigLoader(initial),
      outputStore: output,
      processSupervisorFactory: new FakeSupervisorFactory(supervisor),
      serverFactory: new UnusedServerFactory(),
      watcherFactory: watchers,
    },
  );
  context.after(() => running.close());
  await waitFor(() => output.configs.length === 1);
  assert.ok(watchers.targets[0]?.includes(helper));
  const before = [...(initial.sourceFiles ?? [])];
  await fs.promises.writeFile(nextHelper, 'export const title = "Next";');
  await fs.promises.writeFile(helper, 'export { title } from "./next.ts";');
  watchers.failNext = true;
  watchers.watchers[0]?.change(helper);
  await waitFor(() => watchers.watchers[1]?.closed === true);
  assert.deepEqual(initial.sourceFiles, before);
  assert.equal(watchers.watchers[0]?.closed, false);
  watchers.watchers[0]?.change(helper);
  await waitFor(() => supervisor.restarts === 1);
  assert.ok(watchers.targets[2]?.includes(nextHelper));
  assert.equal(watchers.watchers[0]?.closed, true);
});

test("consumer configuration is a reconfiguration watch target", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);

  assert.ok(watchTargets(config).includes(config.configPath));
  assert.equal(classifyWatchPath(config.configPath, config), "reconfigure");
});

test("dark stylesheet changes classify as reload", async (context) => {
  const fixture = await createFixture(undefined, {
    extraConfig:
      'stylesheets: [{ match: "**/*.html", stylesheets: [], darkStylesheets: ["dark.css"] }],',
  });
  context.after(() => removeFixture(fixture));
  const config = await loadConfig(fixture.root);
  const darkStylesheet = `${fixture.mockupsDir}/dark.css`;

  assert.ok(watchTargets(config).includes(darkStylesheet));
  assert.equal(classifyWatchPath(darkStylesheet, config), "reload");
});

test("watched Serve reloads config with a ready replacement watcher", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const initial: ResolvedConfig = {
    ...loaded,
    watch: { ...loaded.watch, debounceMs: 0 },
  };
  const next: ResolvedConfig = {
    ...initial,
    watch: {
      debounceMs: 0,
      rules: [{ action: "reload", paths: ["extra.css"] }],
    },
  };
  const watchers = new FakeWatcherFactory();
  const output = new FakeOutputStore();
  const supervisor = new FakeSupervisor();
  const loader = new FakeConfigLoader(next);
  const supervisorFactory = new FakeSupervisorFactory(supervisor);
  const running = await serve(
    initial,
    { port: 0, watch: true },
    {
      configLoader: loader,
      outputStore: output,
      processSupervisorFactory: supervisorFactory,
      serverFactory: new UnusedServerFactory(),
      watcherFactory: watchers,
    },
  );
  context.after(() => running.close());

  await waitFor(() => output.configs.length === 1);
  watchers.watchers[0]?.change(initial.configPath);
  await waitFor(() => supervisor.restarts === 1);
  await waitFor(() => output.configs.length === 2);

  assert.equal(loader.loads, 1);
  assert.equal(watchers.watchers.length, 2);
  assert.equal(watchers.watchers[0]?.closed, true);
  assert.deepEqual(supervisorFactory.baseArguments, [
    "__serve-child",
    "--config",
    initial.configPath,
  ]);
  assert.ok(watchers.targets[1]?.includes(initial.configPath));
  assert.ok(watchers.targets[1]?.includes(`${fixture.root}/extra.css`));
  assert.deepEqual(output.configs, [initial, next]);
});

test("failed config adoption retains the last-good watcher and child", async (context) => {
  const fixture = await createFixture();
  context.after(() => removeFixture(fixture));
  const loaded = await loadConfig(fixture.root);
  const initial: ResolvedConfig = {
    ...loaded,
    watch: { ...loaded.watch, debounceMs: 0 },
  };
  const next: ResolvedConfig = {
    ...initial,
    watch: {
      debounceMs: 0,
      rules: [{ action: "reload", paths: ["next.css"] }],
    },
  };
  const watchers = new FakeWatcherFactory();
  const output = new FakeOutputStore();
  const supervisor = new FakeSupervisor();
  const running = await serve(
    initial,
    { port: 0, watch: true },
    {
      configLoader: new FakeConfigLoader(next),
      outputStore: output,
      processSupervisorFactory: new FakeSupervisorFactory(supervisor),
      serverFactory: new UnusedServerFactory(),
      watcherFactory: watchers,
    },
  );
  context.after(() => running.close());

  await waitFor(() => output.configs.length === 1);
  watchers.failNext = true;
  watchers.watchers[0]?.change(initial.configPath);
  await waitFor(() => watchers.watchers[1]?.closed === true);

  assert.equal(watchers.watchers[0]?.closed, false);
  assert.equal(supervisor.restarts, 0);
  assert.deepEqual(output.configs, [initial]);

  watchers.watchers[0]?.change(initial.configPath);
  await waitFor(() => supervisor.restarts === 1);
  await waitFor(() => output.configs.length === 2);

  assert.equal(watchers.watchers[0]?.closed, true);
  assert.equal(watchers.watchers[2]?.closed, false);
  assert.deepEqual(output.configs, [initial, next]);
});

class FakeConfigLoader {
  loads = 0;

  constructor(private readonly config: ResolvedConfig) {}

  async load(_configPath: string): Promise<ResolvedConfig> {
    this.loads += 1;
    return this.config;
  }
}

class FakeOutputStore implements GeneratedOutputStore {
  readonly configs: ResolvedConfig[] = [];
  failNext = false;

  check(_compilation: Compilation, _config: ResolvedConfig): void {}

  async write(
    _compilation: Compilation,
    config: ResolvedConfig,
  ): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("candidate config output failed");
    }
    this.configs.push(config);
  }
}

class FakeWatcherFactory implements ConsumerWatcherFactory {
  readonly targets: string[][] = [];
  readonly watchers: FakeWatcher[] = [];
  failNext = false;

  create(targets: readonly string[]): ConsumerWatcher {
    this.targets.push([...targets]);
    const watcher = new FakeWatcher(this.failNext);
    this.failNext = false;
    this.watchers.push(watcher);
    return watcher;
  }
}

class FakeWatcher implements ConsumerWatcher {
  closed = false;
  private changeCallback: ((path: string) => void) | undefined;
  constructor(private readonly failReady = false) {}

  async close(): Promise<void> {
    this.closed = true;
  }

  onChange(callback: (path: string) => void): void {
    this.changeCallback = callback;
  }

  onError(_callback: (error: Error) => void): void {}

  async ready(): Promise<void> {
    if (this.failReady) throw new Error("candidate watcher failed");
  }

  change(candidate: string): void {
    this.changeCallback?.(candidate);
  }
}

class FakeSupervisorFactory implements ProcessSupervisorFactory {
  baseArguments: string[] = [];

  constructor(private readonly supervisor: ProcessSupervisor) {}

  create(
    _binPath: string,
    baseArguments: readonly string[],
    _requestedPort: number,
  ): ProcessSupervisor {
    this.baseArguments = [...baseArguments];
    return this.supervisor;
  }
}

class FakeSupervisor implements ProcessSupervisor {
  replaceComponentRuntime(): void {}
  restarts = 0;

  async close(): Promise<void> {}

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

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("watched condition did not become true");
}
