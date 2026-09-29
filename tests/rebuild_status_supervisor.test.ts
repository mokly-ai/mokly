import assert from "node:assert/strict";
import test from "node:test";

import type { RebuildStatus } from "@mokly/viewer/runtime";

import { compileCatalogue } from "../dist/build/compile.js";
import { componentRuntime } from "../dist/build/component_runtime.js";
import { loadConfig } from "../dist/config/load.js";
import type { ChildHandle } from "../dist/server/child_process.js";
import { ReadyProcessSupervisor } from "../dist/server/supervisor.js";
import type { ChildCommand } from "../dist/server/update_messages.js";

import { createFixture, removeFixture } from "./helpers/fixture.js";

test("the supervisor replays the latest failed status to a replacement child", async (t) => {
  const fixture = await createFixture();
  t.after(() => removeFixture(fixture));
  const runtime = componentRuntime(
    await compileCatalogue(await loadConfig(fixture.root)),
  );
  const children: ControlledChild[] = [];
  const supervisor = new ReadyProcessSupervisor(
    {
      spawn() {
        const child = new ControlledChild();
        children.push(child);
        return child;
      },
    },
    [],
    0,
  );
  supervisor.replaceComponentRuntime(runtime, "stage");
  const failed: RebuildStatus = {
    failure: { detail: "src/home.tsx failed", id: 2 },
    sequence: 2,
    updateVersion: 1,
    updating: true,
  };
  supervisor.publishRebuildStatus(failed);

  const starting = supervisor.start();
  await waitFor(() => children.length === 1);
  ready(children[0]!);
  await starting;
  assert.deepEqual(statusMessages(children[0]!), [failed]);

  const restarting = supervisor.restart();
  children[0]!.exit();
  await waitFor(() => children.length === 2);
  ready(children[1]!);
  await restarting;
  assert.deepEqual(statusMessages(children[1]!), [failed]);
  const runtimeMessage = children[1]!.messages.find(
    (message) => message.type === "component-runtime",
  );
  assert.equal(runtimeMessage?.type, "component-runtime");
  if (runtimeMessage?.type === "component-runtime")
    assert.equal(runtimeMessage.version, 2);

  const closing = supervisor.close();
  children[1]!.exit();
  await closing;
});

class ControlledChild implements ChildHandle {
  readonly messages: ChildCommand[] = [];
  private readonly messageCallbacks: Array<(value: unknown) => void> = [];
  private readonly exitCallbacks: Array<(code: number | null) => void> = [];

  forceKill(): void {
    this.exit();
  }

  onDisconnect(): void {}
  onError(): void {}

  onExit(callback: (code: number | null) => void): void {
    this.exitCallbacks.push(callback);
  }

  onMessage(callback: (value: unknown) => void): void {
    this.messageCallbacks.push(callback);
  }

  send(message: ChildCommand): void {
    this.messages.push(message);
  }

  terminate(): void {
    this.exit();
  }

  emit(value: unknown): void {
    for (const callback of this.messageCallbacks) callback(value);
  }

  exit(): void {
    for (const callback of this.exitCallbacks.splice(0)) callback(0);
  }
}

function ready(child: ControlledChild): void {
  child.emit({ type: "component-runtime-startup-request" });
  child.emit({ type: "component-runtime-request" });
  child.emit({ port: 48123, type: "ready" });
}

function statusMessages(child: ControlledChild): RebuildStatus[] {
  return child.messages.flatMap((message) =>
    message.type === "rebuild-status" ? [message.status] : [],
  );
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt++) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Child was not created");
}
