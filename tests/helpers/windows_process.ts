import assert from "node:assert/strict";
import childProcess, { type ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import { syncBuiltinESMExports } from "node:module";
import { PassThrough } from "node:stream";
import type { TestContext } from "node:test";
import { setTimeout } from "node:timers/promises";

import koffi from "koffi";

/** Simulate descendants retaining output after the immediate Windows process exits. */
export function windowsProcessFixture(t: TestContext) {
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  Object.defineProperty(process, "platform", { value: "win32" });
  const events: string[] = [];
  const job = {};
  const child = Object.assign(new EventEmitter(), {
    pid: 12345,
    exitCode: null as number | null,
    signalCode: null as NodeJS.Signals | null,
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    connected: true,
    send() {
      events.push("release");
      return true;
    },
    kill() {
      events.push("kill-child");
      child.exitCode = 1;
      return true;
    },
  });
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (child.exitCode === null && child.signalCode === null)
      child.exitCode = 0;
    child.stdout.end();
    child.stderr.end();
    child.emit("close", child.exitCode, child.signalCode);
  };
  let active = 1;
  let configureError = false;
  let assignError = false;
  let terminationError = false;
  let pendingQueries = 0;
  const functions = {
    CreateJobObjectW: () => job,
    SetInformationJobObject: (_job: unknown, _kind: number, bytes: Buffer) => {
      events.push(`limits:${bytes.readUInt32LE(16)}`);
      return configureError ? 0 : 1;
    },
    OpenProcess: () => ({}),
    AssignProcessToJobObject: () => {
      events.push("assign");
      return assignError ? 0 : 1;
    },
    TerminateJobObject: () => {
      events.push("terminate-tree");
      if (terminationError) return 0;
      active = 0;
      queueMicrotask(close);
      return 1;
    },
    QueryInformationJobObject: (
      _job: unknown,
      _kind: number,
      bytes: Buffer,
    ) => {
      events.push("query");
      bytes.writeUInt32LE(pendingQueries-- > 0 ? 1 : active, 40);
      return 1;
    },
    CloseHandle: (handle: unknown) => {
      events.push(handle === job ? "close-job" : "close-process");
      if (handle === job && active) {
        active = 0;
        queueMicrotask(close);
      }
      return 1;
    },
    GetLastError: () => 5,
  };
  t.mock.method(koffi, "load", () => ({
    func: (_callingConvention: string, name: keyof typeof functions) => {
      if (!functions[name])
        throw new Error(`Unexpected native function: ${name}`);
      return functions[name];
    },
  }));
  t.mock.method(childProcess, "spawn", () => {
    events.push("spawn");
    return child as unknown as ChildProcess;
  });
  syncBuiltinESMExports();
  t.after(() => {
    close();
    t.mock.restoreAll();
    syncBuiltinESMExports();
    Object.defineProperty(process, "platform", platform);
  });
  return {
    events,
    child,
    close,
    async waitForEvent(name: string) {
      for (
        let attempt = 0;
        attempt < 1_500 && !events.includes(name);
        attempt++
      )
        await setTimeout(10);
      assert.ok(events.includes(name), `Missing ${name}: ${events.join(", ")}`);
    },
    failConfiguration() {
      configureError = true;
    },
    failAssignment() {
      assignError = true;
    },
    failTermination() {
      terminationError = true;
    },
    holdDrain(queries: number) {
      pendingQueries = queries;
    },
    exitLauncher() {
      child.exitCode = 0;
      child.emit("exit", 0, null);
    },
  };
}
