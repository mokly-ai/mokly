import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { ResourceWatcher } from "../dist/server/resource_watcher.js";
import { classifyWatchPath } from "../dist/server/watch_events.js";

import {
  resourceFixture,
  ResourceWatcherFactory,
} from "./helpers/resource_watcher.js";

const noShutdown = new Promise<void>(() => undefined);

test("unmatched stylesheet rules do not require unused resource files", async (context) => {
  const fixture = await resourceFixture(context);
  const config = {
    ...fixture.config,
    stylesheets: [
      ...fixture.config.stylesheets,
      { match: "screens/absent.html", stylesheets: ["missing.css"] },
    ],
  };
  const compilation = await compileCatalogue(config);
  const factory = new ResourceWatcherFactory();
  const resources = new ResourceWatcher(
    factory,
    () => assert.fail("unexpected resource change"),
    assert.fail,
  );
  context.after(() => resources.close());
  const prepared = await resources.prepare(config, compilation, noShutdown);
  assert.ok(prepared);
  prepared.adopt();
  await prepared.close();
  assert.ok(!resources.paths.has(path.join(config.mockupsDir, "missing.css")));
});

test("discarded resource candidates preserve old inputs until adoption", async (context) => {
  const fixture = await resourceFixture(context);
  const factory = new ResourceWatcherFactory();
  const changes: string[] = [];
  const resources = new ResourceWatcher(
    factory,
    (event) => changes.push(event.path),
    assert.fail,
  );
  context.after(() => resources.close());
  const first = await resources.prepare(
    fixture.config,
    fixture.compilation,
    noShutdown,
  );
  assert.ok(first);
  first.adopt();
  await first.close();
  const old = path.join(fixture.mockupsDir, "a.svg");
  const next = path.join(fixture.mockupsDir, "b.svg");
  const oldWatcher = factory.watchers[0]!;
  assert.equal(oldWatcher.options?.followSymlinks, false);
  assert.equal(oldWatcher.ignore?.(old), false);
  assert.equal(oldWatcher.ignore?.(next), true);
  assert.equal(
    oldWatcher.ignore?.(
      path.join(fixture.mockupsDir, "screens/home.desktop.html"),
    ),
    true,
  );
  await fs.writeFile(
    path.join(fixture.mockupsDir, "nested.css"),
    'main { background: url("b.svg"); }',
  );
  const discarded = await resources.prepare(
    fixture.config,
    fixture.compilation,
    noShutdown,
  );
  assert.ok(discarded);
  await discarded.close();
  assert.equal(factory.watchers[1]?.closeCount, 1);
  assert.equal(oldWatcher.closeCount, 0);
  assert.ok(resources.paths.has(old));
  assert.ok(!resources.paths.has(next));
  oldWatcher.change(old);
  factory.watchers[1]?.change(next);
  assert.deepEqual(changes, [old]);

  const replacement = await resources.prepare(
    fixture.config,
    fixture.compilation,
    noShutdown,
  );
  assert.ok(replacement);
  factory.watchers[2]?.change(next);
  assert.deepEqual(changes, [old]);
  replacement.adopt();
  await replacement.close();
  assert.deepEqual(changes, [old, next]);
  assert.equal(oldWatcher.closeCount, 1);
  assert.equal(
    classifyWatchPath(
      { path: old, kind: "change" },
      fixture.config,
      resources.paths,
    ),
    "ignore",
  );
  assert.equal(
    classifyWatchPath(
      { path: next, kind: "change" },
      fixture.config,
      resources.paths,
    ),
    "reload",
  );
  oldWatcher.change(old);
  assert.deepEqual(changes, [old, next]);
});

test("discovery repeats after attachment so references introduced during readiness are watched", async (context) => {
  const fixture = await resourceFixture(context);
  const factory = new ResourceWatcherFactory();
  factory.onReady = async () => {
    if (factory.watchers.length === 1) {
      await fs.writeFile(
        path.join(fixture.mockupsDir, "nested.css"),
        'main { background: url("b.svg"); }',
      );
    }
  };
  const resources = new ResourceWatcher(
    factory,
    () => assert.fail("unexpected resource change"),
    assert.fail,
  );
  context.after(() => resources.close());
  const prepared = await resources.prepare(
    fixture.config,
    fixture.compilation,
    noShutdown,
  );
  assert.ok(prepared);
  prepared.adopt();
  await prepared.close();
  assert.equal(factory.watchers.length, 2);
  assert.equal(factory.watchers[0]?.closeCount, 1);
  assert.ok(resources.paths.has(path.join(fixture.mockupsDir, "b.svg")));
  assert.ok(!resources.paths.has(path.join(fixture.mockupsDir, "a.svg")));
});

test(
  "shutdown interrupts resource readiness and closes the candidate once",
  { timeout: 5_000 },
  async (context) => {
    const fixture = await resourceFixture(context);
    const factory = new ResourceWatcherFactory();
    let markReady: () => void = () => undefined;
    const readyStarted = new Promise<void>((resolve) => {
      markReady = resolve;
    });
    let signalShutdown: () => void = () => undefined;
    const shutdown = new Promise<void>((resolve) => {
      signalShutdown = resolve;
    });
    factory.onReady = async () => {
      markReady();
      await new Promise<void>(() => undefined);
    };
    const resources = new ResourceWatcher(
      factory,
      () => assert.fail("unexpected resource change"),
      assert.fail,
    );
    const pending = resources.prepare(
      fixture.config,
      fixture.compilation,
      shutdown,
    );
    await readyStarted;
    signalShutdown();
    assert.equal(await pending, undefined);
    await resources.close();
    assert.equal(factory.watchers[0]?.closeCount, 1);
  },
);

test("resource readiness failures close the candidate before propagating", async (context) => {
  const fixture = await resourceFixture(context);
  const factory = new ResourceWatcherFactory();
  const failure = new Error("resource watcher failed");
  factory.onReady = async () => {
    throw failure;
  };
  const resources = new ResourceWatcher(
    factory,
    () => assert.fail("unexpected resource change"),
    assert.fail,
  );
  await assert.rejects(
    resources.prepare(fixture.config, fixture.compilation, noShutdown),
    (error) => error === failure,
  );
  await resources.close();
  assert.equal(factory.watchers[0]?.closeCount, 1);
});
