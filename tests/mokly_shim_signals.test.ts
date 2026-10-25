import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import type { Signal } from "../packages/mokly/src/execution.mjs";
import { executeNative } from "../packages/mokly/src/execution.mjs";

for (const platform of ["linux", "win32"]) {
  test(`native execution handles console signals on ${platform}`, async () => {
    const signals = new EventEmitter();
    const child = new EventEmitter();
    const kills: Signal[] = [];
    let started = 0;
    const result = executeNative("/native/mokly", ["serve"], {
      platform,
      spawn(binary, args, options) {
        started += 1;
        assert.equal(binary, "/native/mokly");
        assert.deepEqual(args, ["serve"]);
        assert.deepEqual(options, { stdio: "inherit" });
        return Object.assign(child, {
          kill(signal: Signal) {
            kills.push(signal);
            return true;
          },
        });
      },
      subscribe: (signal, handler) => signals.on(signal, handler),
      unsubscribe: (signal, handler) => signals.removeListener(signal, handler),
    });
    assert.equal(started, 1);
    for (const signal of platform === "win32"
      ? ["SIGINT", "SIGBREAK"]
      : ["SIGINT", "SIGTERM", "SIGHUP"])
      signals.emit(signal);
    assert.deepEqual(
      kills,
      platform === "win32" ? [] : ["SIGINT", "SIGTERM", "SIGHUP"],
    );
    child.emit("exit", 0);
    assert.equal(await result, 0);
    for (const signal of ["SIGINT", "SIGTERM", "SIGHUP", "SIGBREAK"])
      assert.equal(signals.listenerCount(signal), 0);
  });
}

test("native startup errors remove all signal handlers", async () => {
  const child = new EventEmitter();
  const signals = new EventEmitter();
  const failure = new Error("spawn failed");
  const result = executeNative("missing", [], {
    platform: "linux",
    spawn: () => Object.assign(child, { kill: () => true }),
    subscribe: (signal, handler) => signals.on(signal, handler),
    unsubscribe: (signal, handler) => signals.removeListener(signal, handler),
  });
  child.emit("error", failure);
  await assert.rejects(result, (error) => error === failure);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"])
    assert.equal(signals.listenerCount(signal), 0);
});
