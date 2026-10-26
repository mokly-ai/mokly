import nodeModule from "node:module";
import { MessageChannel, receiveMessageOnPort } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import { asynchronousLoader, recordModulePath } from "./postcss-evidence.js";

const flushKey = Symbol.for("mokly.postcss.asyncFlush");
const loaderFlagKey = Symbol.for("mokly.postcss.asyncLoaderFlag");
let installed = false;
let registering = false;
const ports = new Set<MessagePort>();

/** Observe registration from any preload or from the running plugin. */
export function observeAsyncModuleLoads(): void {
  if (installed || typeof nodeModule.register !== "function") return;
  installed = true;
  const original = nodeModule.register;
  Object.defineProperty(nodeModule, "register", {
    value: function (...args: Parameters<typeof original>): void {
      Reflect.apply(original, nodeModule, args);
      if (!registering) registerAsyncHook();
    },
  });
  nodeModule.syncBuiltinESMExports();
  Object.defineProperty(globalThis, loaderFlagKey, {
    value: observeLoaderFlagHooks,
  });
}

/** Loader flags install hooks without a register call, so the worker observes
 * them after consumer preloads. An earlier register call would start the loader
 * thread before those preloads and make their descriptor positions opaque.
 */
export function observeLoaderFlagHooks(): void {
  const value: unknown = Reflect.get(globalThis, loaderFlagKey);
  if (typeof value === "function" && value !== observeLoaderFlagHooks) {
    value();
    return;
  }
  if (installed && asynchronousLoader && ports.size === 0) registerAsyncHook();
}

/** Completed resolves queue their paths before Node can evaluate the module.
 * Drain those queued messages before framing evidence, even when their event
 * callbacks have not run. Pending resolves do not delay completed CSS work.
 */
export function flushAsyncModulePaths(): void {
  const value: unknown = Reflect.get(globalThis, flushKey);
  if (typeof value === "function" && value !== flushAsyncModulePaths) {
    value();
    return;
  }
  for (const port of ports) {
    let queued;
    while ((queued = receiveMessageOnPort(port)) !== undefined)
      recordPathMessage(queued.message);
  }
}

function recordPathMessage(message: unknown): void {
  if (typeof message === "string") recordModulePath(message);
}

function registerAsyncHook(): void {
  if (registering) return;
  registering = true;
  const { port1, port2 } = new MessageChannel();
  ports.add(port1);
  port1.on("message", recordPathMessage);
  port1.on("close", () => ports.delete(port1));
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
      ports.delete(port1);
      port1.close();
      port2.close();
    }
    registering = false;
  }
}
