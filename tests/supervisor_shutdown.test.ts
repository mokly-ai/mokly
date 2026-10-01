import assert from "node:assert/strict";
import test from "node:test";

import type {
  ChildFactory,
  ChildHandle,
} from "../dist/server/child_process.js";
import { ReadyProcessSupervisor } from "../dist/server/supervisor.js";
import type { ChildCommand } from "../dist/server/update_messages.js";

test("supervisor waits for readiness and shuts down before restart", async () => {
  const factory = new ResponsiveChildFactory();
  const supervisor = new ReadyProcessSupervisor(factory, ["__serve-child"], 0);
  const starting = supervisor.start();
  factory.children[0]?.ready(48123);
  assert.equal(await starting, 48123);
  supervisor.notifyUpdate(["home"]);
  assert.deepEqual(factory.children[0]?.messages, [
    {
      changedIds: ["home"],
      type: "update",
      componentChanges: null,
      version: 2,
    },
  ]);
  supervisor.notifyUpdate(undefined);
  assert.deepEqual(factory.children[0]?.messages[1], {
    changedIds: null,
    componentChanges: null,
    type: "update",
    version: 3,
  });

  const restarting = supervisor.restart();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(factory.children[0]?.messages, [
    {
      changedIds: ["home"],
      componentChanges: null,
      type: "update",
      version: 2,
    },
    {
      changedIds: null,
      componentChanges: null,
      type: "update",
      version: 3,
    },
    { type: "shutdown" },
  ]);
  assert.deepEqual(factory.arguments_[1], [
    "__serve-child",
    "--port",
    "48123",
    "--strict-port",
    "--update-version",
    "4",
  ]);
  factory.children[1]?.ready(48123);
  assert.equal(await restarting, 48123);
  await supervisor.close();
});

test("supervisor retains the resolved Live port across child restarts", async () => {
  const factory = new ResponsiveChildFactory();
  const supervisor = new ReadyProcessSupervisor(
    factory,
    ["__serve-child"],
    0,
    undefined,
    {
      interactiveOrigin: "https://live.example.test",
      interactivePort: 0,
      strictPort: true,
    },
  );
  const starting = supervisor.start();
  assert.deepEqual(factory.arguments_[0], [
    "__serve-child",
    "--port",
    "0",
    "--strict-port",
    "--interactive-port",
    "0",
    "--interactive-origin",
    "https://live.example.test",
    "--update-version",
    "1",
  ]);
  factory.children[0]!.ready(48123, 48124);
  await starting;
  assert.equal(supervisor.interactivePort(), 48124);

  const restarting = supervisor.restart();
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(factory.arguments_[1]!.includes("48124"));
  assert.ok(factory.arguments_[1]!.includes("--strict-port"));
  factory.children[1]!.ready(48123, 48124);
  await restarting;
  await supervisor.close();
});

test(
  "supervisor close waits for an unresponsive child to exit",
  { timeout: 5_000 },
  async () => {
    const factory = new UnresponsiveChildFactory();
    const supervisor = new ReadyProcessSupervisor(
      factory,
      ["__serve-child"],
      0,
      { gracefulMilliseconds: 10, terminateMilliseconds: 10 },
    );
    const starting = supervisor.start();
    factory.child.ready(48123);
    await starting;
    let closed = false;
    const closing = supervisor.close().then(() => {
      closed = true;
    });

    await waitFor(() => factory.child.forceKills === 1);
    try {
      assert.equal(factory.child.terminations, 1);
      assert.equal(factory.child.forceKills, 1);
      assert.equal(closed, false);
    } finally {
      factory.child.exit(0);
      await closing;
    }
  },
);

class UnresponsiveChildFactory implements ChildFactory {
  readonly child = new UnresponsiveChild();

  spawn(_arguments: readonly string[]): ChildHandle {
    return this.child;
  }
}

class ResponsiveChildFactory implements ChildFactory {
  readonly arguments_: string[][] = [];
  readonly children: ResponsiveChild[] = [];

  spawn(arguments_: readonly string[]): ChildHandle {
    this.arguments_.push([...arguments_]);
    const child = new ResponsiveChild();
    this.children.push(child);
    return child;
  }
}

class ResponsiveChild implements ChildHandle {
  readonly messages: ChildCommand[] = [];
  private exitCallback: ((code: number | null) => void) | undefined;
  private messageCallback: ((message: unknown) => void) | undefined;

  forceKill(): void {
    this.exitCallback?.(null);
  }

  onDisconnect(_callback: () => void): void {}

  onError(_callback: (error: Error) => void): void {}

  onExit(callback: (code: number | null) => void): void {
    this.exitCallback = callback;
  }

  onMessage(callback: (message: unknown) => void): void {
    this.messageCallback = callback;
  }

  send(message: ChildCommand): void {
    this.messages.push(message);
    if (message.type === "shutdown")
      queueMicrotask(() => this.exitCallback?.(0));
  }

  terminate(): void {
    this.exitCallback?.(null);
  }

  ready(port: number, interactivePort?: number): void {
    this.messageCallback?.({
      ...(interactivePort === undefined ? {} : { interactivePort }),
      port,
      type: "ready",
    });
  }
}

class UnresponsiveChild implements ChildHandle {
  forceKills = 0;
  terminations = 0;
  private readonly exitCallbacks: Array<(code: number | null) => void> = [];
  private readonly messageCallbacks: Array<(message: unknown) => void> = [];

  forceKill(): void {
    this.forceKills += 1;
  }

  onDisconnect(_callback: () => void): void {}

  onError(_callback: (error: Error) => void): void {}

  onExit(callback: (code: number | null) => void): void {
    this.exitCallbacks.push(callback);
  }

  onMessage(callback: (message: unknown) => void): void {
    this.messageCallbacks.push(callback);
  }

  send(_message: ChildCommand): void {}

  terminate(): void {
    this.terminations += 1;
  }

  exit(code: number | null): void {
    for (const callback of this.exitCallbacks.splice(0)) callback(code);
  }

  ready(port: number): void {
    for (const callback of this.messageCallbacks) {
      callback({ port, type: "ready" });
    }
  }
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("shutdown escalation did not complete");
}
