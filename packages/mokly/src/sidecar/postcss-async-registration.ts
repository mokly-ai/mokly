import nodeModule from "node:module";
import { MessageChannel } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import { recordModulePath } from "./postcss-evidence.js";

const flushKey = Symbol.for("mokly.postcss.asyncFlush");
let installed = false;
let registering = false;
let nextFlush = 0;
const ports = new Set<MessagePort>();
const pending = new Map<number, { ports: Set<MessagePort>; resolve(): void }>();

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
  if (!ports.size) return;
  const id = ++nextFlush;
  await new Promise<void>((resolve) => {
    const waiting = new Set(ports);
    pending.set(id, { ports: waiting, resolve });
    for (const port of waiting) port.postMessage({ kind: "flush", id });
  });
}

function registerAsyncHook(): void {
  if (registering) return;
  registering = true;
  const { port1, port2 } = new MessageChannel();
  ports.add(port1);
  port1.on("message", (message: unknown) => {
    if (
      message &&
      typeof message === "object" &&
      "kind" in message &&
      message.kind === "flushed" &&
      "id" in message &&
      typeof message.id === "number"
    ) {
      const waiting = pending.get(message.id);
      waiting?.ports.delete(port1);
      if (waiting && waiting.ports.size === 0) {
        waiting.resolve();
        pending.delete(message.id);
      }
      return;
    }
    if (
      message &&
      typeof message === "object" &&
      "kind" in message &&
      message.kind === "path" &&
      "url" in message &&
      typeof message.url === "string"
    )
      recordModulePath(message.url);
  });
  port1.on("close", () => {
    ports.delete(port1);
    for (const [id, waiting] of pending) {
      waiting.ports.delete(port1);
      if (waiting.ports.size === 0) {
        waiting.resolve();
        pending.delete(id);
      }
    }
  });
  port1.unref();
  try {
    nodeModule.register("./postcss-async-loader.mjs", {
      parentURL: import.meta.url,
      data: { paths: port2 },
      transferList: [port2],
    });
    Object.defineProperty(globalThis, flushKey, {
      value: flushAsyncModulePaths,
    });
  } finally {
    registering = false;
  }
}
