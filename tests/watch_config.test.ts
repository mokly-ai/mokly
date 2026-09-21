import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import { serve } from "../dist/server/serve.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";
import { watchTargets } from "../dist/server/watch_paths.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";
import {
  FakeConfigLoader,
  FakeOutputStore,
  FakeWatcherFactory,
  FakeSupervisorFactory,
  FakeSupervisor,
  UnusedServerFactory,
} from "./helpers/watch_config.js";

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
  assert.equal(
    classifyWatchPath({ path: config.configPath, kind: "change" }, config),
    "reconfigure",
  );
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
  assert.equal(
    classifyWatchPath({ path: darkStylesheet, kind: "change" }, config),
    "reload",
  );
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

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("watched condition did not become true");
}
