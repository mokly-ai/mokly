import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import type { ResolvedConfig } from "../dist/config/types.js";
import type { ChildHandle } from "../dist/server/child_process.js";
import type {
  RuntimeMessage,
  RuntimeStartupMessage,
} from "../dist/server/controls/runtime_ipc.js";
import { PlainServeReporter } from "../dist/server/reporter.js";
import { serve } from "../dist/server/serve.js";
import { ReadyProcessSupervisor } from "../dist/server/supervisor.js";
import type {
  CatalogueCompleteMessage,
  ChildCommand,
  ChildUpdateMessage,
} from "../dist/server/update_messages.js";
import type { WatchEvent } from "../dist/server/watch_events.js";

import {
  createFixture,
  removeFixture,
  validEntrySource,
  type TestFixture,
} from "./helpers/fixture.js";

/** Record parent commands, then exit on shutdown or when the test crashes it. */
class RecordingChild implements ChildHandle {
  readonly messages: ChildCommand[] = [];
  readonly #receives: ((message: unknown) => void)[] = [];
  readonly #exits: ((code: number | null) => void)[] = [];
  onMessage(callback: (message: unknown) => void): void {
    this.#receives.push(callback);
  }
  onExit(callback: (code: number | null) => void): void {
    this.#exits.push(callback);
  }
  onError(): void {}
  onDisconnect(): void {}
  send(message: ChildCommand): void {
    this.messages.push(message);
    if (message.type === "shutdown") queueMicrotask(() => this.exit());
  }
  terminate(): void {
    this.exit();
  }
  forceKill(): void {
    this.exit();
  }
  exit(): void {
    for (const callback of this.#exits.splice(0)) callback(0);
  }
  /** Request the startup graph and announce readiness like a live-index child. */
  start(): void {
    for (const message of [
      { type: "component-runtime-startup-request" },
      { type: "component-runtime-request" },
      { type: "ready", port: 48123 },
    ])
      for (const callback of this.#receives) callback(message);
  }
  completions(): CatalogueCompleteMessage[] {
    return this.messages.filter(
      (message): message is CatalogueCompleteMessage =>
        message.type === "catalogue-complete",
    );
  }
  startup(): RuntimeStartupMessage | undefined {
    return this.messages.find(
      (message): message is RuntimeStartupMessage =>
        message.type === "component-runtime-startup",
    );
  }
}

function recordingSupervisor(children: RecordingChild[]) {
  return new ReadyProcessSupervisor(
    {
      spawn() {
        const child = new RecordingChild();
        children.push(child);
        queueMicrotask(() => child.start());
        return child;
      },
    },
    [],
    0,
  );
}

/** Run the real watched parent with recording children and a test-driven watcher. */
async function watchedParent(fixture: TestFixture, config: ResolvedConfig) {
  const children: RecordingChild[] = [];
  const diagnostics: string[] = [];
  const supervisor = recordingSupervisor(children);
  let changed: ((event: WatchEvent) => void) | undefined;
  const running = await serve(
    config,
    { port: 0, watch: true },
    {
      configLoader: { load: async () => config },
      outputStore: { check() {}, async write() {} },
      processSupervisorFactory: { create: () => supervisor },
      reporter: new PlainServeReporter((value) => diagnostics.push(value)),
      serverFactory: {
        start: async () => {
          throw new Error("Unexpected in-process server");
        },
      },
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
    },
  );
  fixture.beforeRemove(() => running.close());
  return {
    children,
    change(file: string): void {
      assert.ok(changed, "watched Serve registered a source watcher");
      changed({ path: file, kind: "change" });
    },
    async until<Value>(read: () => Value | undefined): Promise<Value> {
      const deadline = Date.now() + 20_000;
      for (;;) {
        const value = read();
        if (value !== undefined) return value;
        if (Date.now() > deadline)
          assert.fail(`no expected IPC message; ${diagnostics.join("")}`);
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    },
  };
}

test(
  "every completion carries the current checked list after repeated resource reloads",
  { timeout: 60_000 },
  async (t) => {
    const fixture = await createFixture(
      validEntrySource({ body: '<a href="../../guide.html">Guide</a>' }),
      { extraConfig: "watch: { debounceMs: 0 }," },
    );
    t.after(() => removeFixture(fixture));
    const guide = path.join(fixture.mockupsDir, "guide.html");
    await fs.writeFile(guide, "<p>Guide</p>");
    await fs.writeFile(path.join(fixture.mockupsDir, "spec.pdf"), "%PDF-1.4");
    const parent = await watchedParent(fixture, await loadConfig(fixture.root));
    const child = parent.children[0]!;
    await parent.until(() => child.completions()[0]);
    const reload = async (html: string) => {
      const start = child.messages.length;
      await fs.writeFile(guide, html);
      parent.change(guide);
      const { runtime } = await parent.until(() =>
        child.messages
          .slice(start)
          .find(
            (message): message is RuntimeMessage =>
              message.type === "component-runtime",
          ),
      );
      return parent.until(() =>
        child
          .completions()
          .find((message) => message.generation === runtime.generation),
      );
    };
    await reload('<a href="spec.pdf">PDF</a>');
    const second = await reload('<a href="spec.pdf">Spec</a>');
    assert.deepEqual(second.manifest.assetClosure, ["guide.html"]);
    assert.deepEqual(
      [...(second.assetClosure ?? [])].sort(),
      ["guide.html", "spec.pdf"],
      "the second reload's completion keeps the PDF that the first linked",
    );
    for (const [index, message] of child.messages.entries()) {
      if (message.type !== "catalogue-complete") continue;
      const update = child.messages
        .slice(index + 1)
        .find(
          (next): next is ChildUpdateMessage =>
            next.type === "update" && next.assetClosure !== undefined,
        );
      assert.deepEqual(message.assetClosure, update?.assetClosure);
    }
  },
);

test(
  "a restarted child starts with the last checked list unless the config changed",
  { timeout: 90_000 },
  async (t) => {
    const fixture = await createFixture(
      validEntrySource({ body: '<a href="../../spec.pdf">PDF</a>' }),
      {
        extraConfig:
          'watch: { debounceMs: 0, rules: [{ action: "restart", paths: ["**/*.txt"] }] },',
      },
    );
    t.after(() => removeFixture(fixture));
    await fs.writeFile(path.join(fixture.mockupsDir, "spec.pdf"), "%PDF-1.4");
    const trigger = path.join(fixture.root, "restart.txt");
    await fs.writeFile(trigger, "restart");
    const parent = await watchedParent(fixture, await loadConfig(fixture.root));
    const startup = (index: number) =>
      parent.until(() => parent.children[index]?.startup());
    const settled = (index: number) =>
      parent.until(() => parent.children[index]?.completions()[0]);
    assert.equal((await startup(0)).assetClosure, undefined);
    await settled(0);
    parent.change(trigger);
    assert.deepEqual((await startup(1)).assetClosure, ["spec.pdf"]);
    await settled(1);
    parent.children[1]!.exit();
    assert.deepEqual((await startup(2)).assetClosure, ["spec.pdf"]);
    await settled(2);
    parent.change(fixture.configPath);
    assert.equal((await startup(3)).assetClosure, undefined);
    await settled(3);
    parent.change(trigger);
    assert.deepEqual((await startup(4)).assetClosure, ["spec.pdf"]);
  },
);

test("the supervisor hands each new child the staged generation's last checked list", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const compilation = await compileCatalogue(await loadConfig(fixture.root));
  const runtime = componentRuntime(compilation);
  const children: RecordingChild[] = [];
  const supervisor = recordingSupervisor(children);
  fixture.beforeRemove(() => supervisor.close());
  supervisor.replaceComponentRuntime(runtime, "stage");
  await supervisor.start();
  supervisor.completeCatalogue(compilation.manifest, "b".repeat(32), [
    "stale.pdf",
  ]);
  supervisor.completeCatalogue(compilation.manifest, runtime.generation, [
    "spec.pdf",
  ]);
  assert.deepEqual(children[0]!.completions(), [
    {
      type: "catalogue-complete",
      manifest: compilation.manifest,
      generation: runtime.generation,
      version: 3,
      assetClosure: ["spec.pdf"],
    },
  ]);
  await supervisor.restart();
  assert.deepEqual(children[1]!.startup()?.assetClosure, ["spec.pdf"]);
  await supervisor.close();
  supervisor.completeCatalogue(compilation.manifest, runtime.generation, [
    "late.pdf",
  ]);
  await supervisor.start();
  assert.deepEqual(children[2]!.startup()?.assetClosure, ["late.pdf"]);
  supervisor.discardCheckedClosure();
  await supervisor.restart();
  assert.equal(children[3]!.startup()?.assetClosure, undefined);
});
