import nodeModule from "node:module";
import { setImmediate } from "node:timers/promises";
import { MessageChannel } from "node:worker_threads";

import { recordModulePath } from "./postcss-evidence.js";

const flushKey = Symbol.for("mokly.postcss.asyncFlush");
let installed = false;
let registering = false;
let nextFlush = 0;
type PortState = {
  state: Int32Array;
  receivedSequence: number;
};
const ports = new Set<PortState>();
let flushQueue: Promise<void> = Promise.resolve();

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
  const next = flushQueue.then(flushOwnAsyncModulePaths);
  flushQueue = next.catch(() => {});
  return next;
}

async function flushOwnAsyncModulePaths(): Promise<void> {
  while (ports.size) {
    const snapshot = [...ports];
    for (const state of snapshot) {
      const id = ++nextFlush;
      Atomics.store(state.state, 0, id);
      Atomics.notify(state.state, 0);
      while (
        ports.has(state) &&
        (Atomics.load(state.state, 3) < id ||
          state.receivedSequence < Atomics.load(state.state, 2))
      )
        await setImmediate();
      if (ports.has(state)) {
        Atomics.store(state.state, 0, 0);
        Atomics.notify(state.state, 0);
      }
    }
    if (
      ports.size === snapshot.length &&
      snapshot.every((state) => ports.has(state))
    )
      return;
  }
}

function registerAsyncHook(): void {
  if (registering) return;
  registering = true;
  const { port1, port2 } = new MessageChannel();
  const state: PortState = {
    state: new Int32Array(new SharedArrayBuffer(16)),
    receivedSequence: 0,
  };
  ports.add(state);
  port1.on("message", (message: unknown) => {
    if (
      message &&
      typeof message === "object" &&
      "kind" in message &&
      message.kind === "path" &&
      "sequence" in message &&
      typeof message.sequence === "number"
    ) {
      state.receivedSequence = Math.max(
        state.receivedSequence,
        message.sequence,
      );
      if ("url" in message && typeof message.url === "string")
        recordModulePath(message.url);
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
      data: { paths: port2, state: state.state.buffer },
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
