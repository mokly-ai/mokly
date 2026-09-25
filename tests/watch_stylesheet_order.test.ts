import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { FileSystemConfigLoader, loadConfig } from "../dist/config/load.js";
import { serve } from "../dist/server/serve.js";
import type { ConsumerWatcher } from "../dist/server/watcher.js";

import {
  declared,
  fixtureWithSheets,
} from "./helpers/component_stylesheet_fixture.js";
import { removeFixture } from "./helpers/fixture.js";
import {
  FakeOutputStore,
  FakeSupervisor,
  FakeSupervisorFactory,
  FakeWatcherFactory,
  UnusedServerFactory,
} from "./helpers/watch_config.js";

class RecordingWatchers extends FakeWatcherFactory {
  failOnTarget: string | undefined;
  constructor(
    private readonly configPath: string,
    private readonly marker: string,
    readonly events: string[],
  ) {
    super();
  }

  override create(targets: readonly string[]): ConsumerWatcher {
    if (this.failOnTarget && targets.includes(this.failOnTarget)) {
      this.failNext = true;
      this.failOnTarget = undefined;
    }
    const watcher = super.create(targets);
    if (!targets.includes(this.configPath)) return watcher;
    this.events.push(`watch:create:${this.phase()}`);
    return {
      close: () => watcher.close(),
      onChange: (callback) => watcher.onChange(callback),
      onError: (callback) => watcher.onError(callback),
      ready: async () => {
        await watcher.ready();
        this.events.push(`watch:ready:${this.phase()}`);
      },
    };
  }

  private phase(): string {
    return fs.existsSync(this.marker) ? "evaluated" : "pending";
  }

  activeSource() {
    const index = this.targets.findLastIndex((targets) =>
      targets.includes(this.configPath),
    );
    return this.watchers[index];
  }

  sourceTargets(): string[][] {
    return this.targets.filter((targets) => targets.includes(this.configPath));
  }
}

class RecordingSupervisor extends FakeSupervisor {
  constructor(private readonly events: string[]) {
    super();
  }

  override async start(): Promise<number> {
    this.events.push("child:start");
    return super.start();
  }

  override async restart(): Promise<number> {
    this.events.push("child:restart");
    return super.restart();
  }
}

async function setup(context: test.TestContext) {
  const fixture = await fixtureWithSheets(declared(), "stylesheets: [],");
  context.after(() => removeFixture(fixture));
  const marker = path.join(fixture.root, "evaluated.marker");
  await fs.promises.writeFile(
    fixture.entryPath,
    `import { writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(marker)}, "evaluated");\n${await fs.promises.readFile(fixture.entryPath, "utf8")}`,
  );
  const config = await loadConfig(fixture.root);
  config.watch.debounceMs = 0;
  const events: string[] = [];
  const watchers = new RecordingWatchers(config.configPath, marker, events);
  const output = new FakeOutputStore();
  const supervisor = new RecordingSupervisor(events);
  const running = await serve(
    config,
    { port: 0, watch: true },
    {
      configLoader: new FileSystemConfigLoader(),
      outputStore: output,
      processSupervisorFactory: new FakeSupervisorFactory(supervisor),
      serverFactory: new UnusedServerFactory(),
      watcherFactory: watchers,
    },
  );
  fixture.beforeRemove(() => running.close());
  return { config, events, fixture, marker, output, supervisor, watchers };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("watcher state did not become ready");
}

test("startup watches source before evaluating and declared CSS before child readiness", async (context) => {
  const { config, events, fixture, watchers } = await setup(context);
  assert.deepEqual(
    events.filter(
      (event) => event.startsWith("watch:") || event === "child:start",
    ),
    [
      "watch:create:pending",
      "watch:ready:pending",
      "watch:create:evaluated",
      "watch:ready:evaluated",
      "child:start",
    ],
  );
  const [initial, extended] = watchers.sourceTargets();
  assert.ok(initial);
  assert.ok(extended);
  assert.ok(initial.includes(config.configPath));
  assert.equal(
    initial.includes(path.join(fixture.mockupsDir, "action.css")),
    false,
  );
  for (const file of ["action.css", "pane.css"])
    assert.ok(extended.includes(path.join(fixture.mockupsDir, file)));
});

test("reconfiguration watches source before evaluation and replaces declarations before restart", async (context) => {
  const { config, events, fixture, marker, output, supervisor, watchers } =
    await setup(context);
  await waitFor(() => output.configs.length === 1);
  await fs.promises.writeFile(
    path.join(fixture.mockupsDir, "replacement.css"),
    ".replacement{color:green}",
  );
  await fs.promises.writeFile(
    fixture.entryPath,
    (await fs.promises.readFile(fixture.entryPath, "utf8")).replace(
      'stylesheets: ["action.css"]',
      'stylesheets: ["replacement.css"]',
    ),
  );
  await fs.promises.rm(marker);
  const start = events.length;
  watchers.activeSource()?.change(config.configPath);
  await waitFor(() => supervisor.restarts === 1);
  assert.deepEqual(
    events
      .slice(start)
      .filter(
        (event) => event.startsWith("watch:") || event === "child:restart",
      ),
    [
      "watch:create:pending",
      "watch:ready:pending",
      "watch:create:evaluated",
      "watch:ready:evaluated",
      "child:restart",
    ],
  );
  const extended = watchers.sourceTargets().at(-1);
  assert.ok(extended);
  assert.ok(
    extended.includes(path.join(fixture.mockupsDir, "replacement.css")),
  );
  assert.ok(extended.includes(path.join(fixture.mockupsDir, "pane.css")));
  assert.equal(
    extended.includes(path.join(fixture.mockupsDir, "action.css")),
    false,
  );
});

test("failed declared-watch extension retains the last-good source watcher and child", async (context) => {
  const { config, fixture, marker, output, supervisor, watchers } =
    await setup(context);
  await waitFor(() => output.configs.length === 1);
  const prior = watchers.activeSource();
  assert.ok(prior);
  const replacement = path.join(fixture.mockupsDir, "replacement.css");
  await fs.promises.writeFile(replacement, ".replacement{color:green}");
  await fs.promises.writeFile(
    fixture.entryPath,
    (await fs.promises.readFile(fixture.entryPath, "utf8")).replace(
      'stylesheets: ["action.css"]',
      'stylesheets: ["replacement.css"]',
    ),
  );
  await fs.promises.rm(marker);
  watchers.failOnTarget = replacement;
  prior.change(config.configPath);
  await waitFor(
    () =>
      watchers.sourceTargets().length === 4 &&
      watchers.activeSource()?.closed === true,
  );
  assert.equal(prior.closed, false);
  assert.equal(supervisor.restarts, 0);
  assert.equal(output.configs.length, 1);
});
