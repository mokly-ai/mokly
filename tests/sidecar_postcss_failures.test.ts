import assert from "node:assert/strict";
import { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { setImmediate } from "node:timers/promises";

import { PostcssWorkers } from "../packages/mokly/src/sidecar/postcss.js";

import { cssParams } from "./helpers/sidecar.js";

class Child extends ChildProcess {
  override exitCode: number | null = null;
}

for (const failure of [
  "error",
  "exit",
  "disconnect",
  "send-error",
  "send-throw",
] as const)
  test(`PostCSS reports ${failure} before a pending request can lose its child`, async (context) => {
    context.mock.method(
      fs.promises,
      "realpath",
      async (file: Parameters<typeof fs.promises.realpath>[0]) => String(file),
    );
    const child = new Child();
    let sends = 0;
    context.mock.method(child, "kill", () => {
      child.exitCode = 1;
      child.emit("exit", 1, null);
      return true;
    });
    child.send = (_message, ...args: unknown[]) => {
      sends++;
      if (
        sends ===
        (failure === "disconnect" || failure.startsWith("send-") ? 2 : 1)
      ) {
        if (failure === "error")
          child.emit("error", new Error("fixture boot failed"));
        else if (failure === "exit") {
          child.exitCode = 17;
          child.emit("exit", 17, null);
        } else if (failure === "send-throw")
          throw new Error("fixture send failed");
        else if (failure === "send-error") {
          const callback = args.find((arg) => typeof arg === "function");
          if (typeof callback === "function")
            callback(new Error("fixture send failed"));
        } else child.emit("disconnect");
      }
      return true;
    };
    const workers = new PostcssWorkers(
      () => {},
      () => {},
      () => child,
    );
    context.after(() => workers.dispose());
    const result = workers
      .process(
        cssParams({
          sourceRoot: path.resolve("repo"),
          moduleResolution: {
            aliases: {},
            conditions: [],
            loaders: {},
            mainFields: [],
            packageRoots: [],
            resolveExtensions: [],
          },
        }),
      )
      .then(
        () => "success",
        (error: unknown) => error,
      );
    const outcome = await Promise.race([result, setImmediate("still pending")]);
    assert.ok(outcome instanceof Error, String(outcome));
    assert.match(
      outcome.message,
      failure === "error"
        ? /fixture boot failed/
        : failure === "exit"
          ? /exited with 17/
          : failure.startsWith("send-")
            ? /fixture send failed/
            : /disconnect/,
    );
    assert.equal("code" in outcome && outcome.code, "bundle-failed");
  });

test("a failed send releases the child before its exit event", async (context) => {
  context.mock.method(
    fs.promises,
    "realpath",
    async (file: Parameters<typeof fs.promises.realpath>[0]) => String(file),
  );
  const first = new Child();
  const second = new Child();
  let launches = 0;
  first.send = () => {
    first.emit("error", new Error("fixture send failed"));
    return false;
  };
  context.mock.method(first, "kill", () => true);
  second.send = (message) => {
    if (message && typeof message === "object" && "id" in message)
      second.emit("message", {
        id: message.id,
        result: {
          text: "replacement",
          dependencies: [],
          readEvidence: { coverage: "incomplete", reads: [], modules: [] },
          unmappedDependencyDirectories: [],
        },
      });
    return true;
  };
  context.mock.method(second, "kill", () => {
    second.exitCode = 0;
    second.emit("exit", 0, null);
    return true;
  });
  const workers = new PostcssWorkers(
    () => {},
    () => {},
    () => (++launches === 1 ? first : second),
  );
  context.after(() => workers.dispose());
  const params = cssParams({
    sourceRoot: path.resolve("repo"),
    moduleResolution: {
      aliases: {},
      conditions: [],
      loaders: {},
      mainFields: [],
      packageRoots: [],
      resolveExtensions: [],
    },
  });
  await assert.rejects(workers.process(params), /fixture send failed/);
  assert.equal(first.exitCode, null);
  assert.equal((await workers.process(params)).text, "replacement");
  assert.equal(launches, 2);
  first.exitCode = 1;
  first.emit("exit", 1, null);
  assert.equal((await workers.process(params)).text, "replacement");
  assert.equal(launches, 2);
});
