import assert from "node:assert/strict";
import fs from "node:fs/promises";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import {
  componentRuntime,
  type ComponentRuntime,
} from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import type { ChildHandle } from "../dist/server/child_process.js";
import { serve } from "../dist/server/serve.js";
import { ReadyProcessSupervisor } from "../dist/server/supervisor.js";
import type { ChildCommand } from "../dist/server/update_messages.js";
import type { WatchEvent } from "../dist/server/watch_events.js";

import { componentEntrySource } from "./helpers/component_fixture.js";
import { createFixture, removeFixture } from "./helpers/fixture.js";

class DelayedChild implements ChildHandle {
  autoExit = () => false;
  readonly messages: ChildCommand[] = [];
  readonly listeners: ((value: unknown) => void)[] = [];
  readonly exits: ((code: number | null) => void)[] = [];
  onMessage(callback: (value: unknown) => void) {
    this.listeners.push(callback);
  }
  onExit(callback: (code: number | null) => void) {
    this.exits.push(callback);
  }
  onError() {}
  onDisconnect() {}
  send(message: ChildCommand) {
    this.messages.push(message);
    if (message.type === "shutdown" && this.autoExit())
      queueMicrotask(() => this.exit());
  }
  terminate() {
    this.exit();
  }
  forceKill() {
    this.exit();
  }
  emit(value: unknown) {
    for (const callback of this.listeners) callback(value);
  }
  exit() {
    for (const callback of this.exits.splice(0)) callback(0);
  }
}

for (const action of ["rebuild", "reconfigure", "live"] as const) {
  test(`watched ${action} keeps catalogue and component generations together`, async (t) => {
    const source = componentEntrySource();
    const fixture = await createFixture(source, {
      extraConfig: "watch: { debounceMs: 0 },",
    });
    const config = await loadConfig(fixture.root);
    let cleaningUp = false;
    const children: DelayedChild[] = [];
    const supervisor = new ReadyProcessSupervisor(
      {
        spawn() {
          const child = new DelayedChild();
          child.autoExit = () => cleaningUp;
          children.push(child);
          queueMicrotask(() => {
            child.emit({ type: "component-runtime-startup-request" });
            child.emit({ type: "ready", port: 48123 });
            child.emit({ type: "component-runtime-request" });
          });
          return child;
        },
      },
      [],
      0,
    );
    let changed: ((event: WatchEvent) => void) | undefined;
    const running = await serve(
      config,
      { port: 0, watch: true },
      {
        configLoader: { load: async () => config },
        outputStore: { check() {}, async write() {} },
        processSupervisorFactory: { create: () => supervisor },
        watcherFactory: {
          create: () => ({
            async ready() {},
            async close() {},
            onError() {},
            onChange(callback) {
              changed ??= callback;
            },
          }),
        },
        serverFactory: {
          start: async () => {
            throw new Error("Unexpected in-process server");
          },
        },
      },
    );
    t.after(async () => {
      cleaningUp = true;
      const closing = running.close();
      for (const child of children) child.exit();
      await closing;
      await removeFixture(fixture);
    });
    const first = children[0]!;
    const initialStartup = first.messages.find(
      (message) => message.type === "component-runtime-startup",
    )!;
    assert.equal(initialStartup.type, "component-runtime-startup");
    const initial = first.messages.find(
      (message) => message.type === "component-runtime",
    )!;
    assert.equal(initial.type, "component-runtime");
    const edit =
      action === "live"
        ? source.replace(
            "<button data-viewport=",
            '<button className="updated" data-viewport=',
          )
        : source.replace("maxLength: 80", "maxLength: 100");
    await fs.writeFile(fixture.entryPath, edit);
    changed!({
      path: action === "reconfigure" ? config.configPath : fixture.entryPath,
      kind: "change",
    });
    await waitFor(() =>
      first.messages.some(
        (message) =>
          message.type === (action === "live" ? "update" : "shutdown"),
      ),
    );
    const runtimes = first.messages.filter(
      (message) => message.type === "component-runtime",
    );
    if (action === "live") {
      assert.equal(children.length, 1);
      assert.equal(runtimes.length, 2);
      assert.notEqual(
        runtimes[1]!.runtime.generation,
        initial.runtime.generation,
      );
      assert.equal(
        first.messages.filter(
          (message) => message.type === "component-runtime-startup",
        ).length,
        1,
      );
    } else {
      assert.deepEqual(
        runtimes,
        [initial],
        "the old child must retain its initial runtime while shutdown is delayed",
      );
      assert.equal(children.length, 1);
      first.exit();
      await waitFor(
        () =>
          children.length === 2 &&
          children[1]!.messages.some(
            (message) => message.type === "component-runtime",
          ),
      );
      const nextStartup = children[1]!.messages.find(
        (message) => message.type === "component-runtime-startup",
      )!;
      const next = children[1]!.messages.find(
        (message) => message.type === "component-runtime",
      )!;
      assert.equal(next.type, "component-runtime");
      assert.equal(nextStartup.type, "component-runtime-startup");
      assert.notEqual(next.runtime.generation, initial.runtime.generation);
      assert.notDeepEqual(nextStartup.manifest, initialStartup.manifest);
    }
  });
}

test("staging during startup cannot change the spawned child's retained graph", async (t) => {
  const fixture = await createFixture(componentEntrySource());
  t.after(() => removeFixture(fixture));
  const first = componentRuntime(
    await compileCatalogue(await loadConfig(fixture.root)),
  );
  const second: ComponentRuntime = { ...first, generation: "b".repeat(32) };
  const child = new DelayedChild();
  const supervisor = new ReadyProcessSupervisor({ spawn: () => child }, [], 0);
  supervisor.replaceComponentRuntime(first, "stage");
  const starting = supervisor.start();
  supervisor.replaceComponentRuntime(second, "stage");
  child.emit({ type: "component-runtime-startup-request" });
  child.emit({ type: "ready", port: 48123 });
  child.emit({ type: "component-runtime-request" });
  await starting;
  const transferred = child.messages[1];
  assert.equal(transferred?.type, "component-runtime");
  if (transferred?.type === "component-runtime") {
    assert.equal(Object.hasOwn(transferred.runtime, "config"), false);
    assert.equal(Object.hasOwn(transferred.runtime, "manifest"), false);
  }
  assert.deepEqual(child.messages, [
    {
      config: first.config,
      manifest: first.manifest,
      type: "component-runtime-startup",
    },
    {
      type: "component-runtime",
      runtime: transferredRuntime(first),
      version: 2,
    },
  ]);
  const closing = supervisor.close();
  child.exit();
  await closing;
});

function transferredRuntime(runtime: ComponentRuntime) {
  return {
    bundle: runtime.bundle,
    generation: runtime.generation,
    outputs: runtime.outputs,
    stylesheetRoutes: runtime.stylesheetRoutes,
    styleOutputs: runtime.styleOutputs,
  };
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The watched update did not arrive");
}
