import nodeModule from "node:module";
import { setImmediate } from "node:timers/promises";
import { MessageChannel } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import { recordModulePath } from "./postcss-evidence.js";

const flushKey = Symbol.for("mokly.postcss.asyncFlush");
let installed = false;
let registering = false;
type PortState = {
  port: MessagePort;
  pathSequence: number;
  acknowledgedSequence: number;
};
const ports = new Set<PortState>();

const asynchronousLoader = [
  ...process.execArgv,
  process.env.NODE_OPTIONS ?? "",
].some((value) => /--(?:experimental-)?loader(?:=|\s|$)/.test(value));
const consumerImport = [
  ...process.execArgv,
  process.env.NODE_OPTIONS ?? "",
].some((value) => /--import(?:=|\s|$)/.test(value));

/** Register the resolve hook when an asynchronous loader can be present. */
export function observeAsyncModuleLoads(): void {
  if (
    (!asynchronousLoader && !consumerImport) ||
    installed ||
    typeof nodeModule.register !== "function"
  )
    return;
  installed = true;
  const original = nodeModule.register;
  Object.defineProperty(nodeModule, "register", {
    value: function (...args: unknown[]): unknown {
      const result = Reflect.apply(original, nodeModule, args as never);
      if (!registering) registerAsyncHook();
      return result;
    },
  });
  if (asynchronousLoader) registerAsyncHook();
}

/** Await an acknowledgement from the loader thread before framing evidence. */
export async function flushAsyncModulePaths(): Promise<void> {
  const value: unknown = Reflect.get(globalThis, flushKey);
  if (typeof value === "function" && value !== flushAsyncModulePaths)
    return value();
  while (ports.size) {
    const snapshot = [...ports];
    await setImmediate();
    if (
      ports.size === snapshot.length &&
      snapshot.every(
        (state) =>
          ports.has(state) && state.acknowledgedSequence >= state.pathSequence,
      )
    ) {
      await setImmediate();
      if (
        ports.size === snapshot.length &&
        snapshot.every(
          (state) =>
            ports.has(state) &&
            state.acknowledgedSequence >= state.pathSequence,
        )
      )
        return;
    }
  }
}

function registerAsyncHook(): void {
  if (registering) return;
  registering = true;
  const { port1, port2 } = new MessageChannel();
  const state: PortState = {
    port: port1,
    pathSequence: 0,
    acknowledgedSequence: 0,
  };
  ports.add(state);
  port1.on("message", (message: unknown) => {
    if (
      message &&
      typeof message === "object" &&
      "kind" in message &&
      (message.kind === "path" || message.kind === "ack") &&
      "sequence" in message &&
      typeof message.sequence === "number"
    ) {
      if (message.kind === "path") {
        state.pathSequence = Math.max(state.pathSequence, message.sequence);
        if ("url" in message && typeof message.url === "string")
          recordModulePath(message.url);
      } else
        state.acknowledgedSequence = Math.max(
          state.acknowledgedSequence,
          message.sequence,
        );
      return;
    }
  });
  port1.on("close", () => {
    ports.delete(state);
  });
  port1.unref();
  let registered = false;
  try {
    nodeModule.register("./postcss-async-loader.mjs", {
      parentURL: import.meta.url,
      data: { paths: port2 },
      transferList: [port2],
    });
    registered = true;
    Object.defineProperty(globalThis, flushKey, {
      value: flushAsyncModulePaths,
    });
  } finally {
    if (!registered) {
      ports.delete(state);
      port1.close();
    }
    registering = false;
  }
}
