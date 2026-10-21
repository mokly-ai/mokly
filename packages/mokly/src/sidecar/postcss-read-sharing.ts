import childProcess from "node:child_process";
import nodeModule, { syncBuiltinESMExports } from "node:module";
import { types } from "node:util";
import workerThreads, { MessagePort } from "node:worker_threads";

import { handleDescriptor } from "./postcss-read-handles.js";
import { invalidate, opaqueDescriptorAccess } from "./postcss-read-position.js";

function field(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object") return;
  if (types.isProxy(value)) {
    opaqueDescriptorAccess();
    return;
  }
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor?.get || descriptor?.set) {
    opaqueDescriptorAccess();
    return;
  }
  return descriptor?.value;
}

function shareStdio(options: unknown): void {
  const stdio = field(options, "stdio");
  if (stdio === "inherit") {
    for (const fd of [0, 1, 2]) invalidate(fd);
    return;
  }
  if (!Array.isArray(stdio) || types.isProxy(stdio)) return;
  for (let index = 0; index < stdio.length; index++) {
    const entry = field(stdio, index);
    if (typeof entry === "number") invalidate(entry);
    const fd = field(entry, "fd");
    if (typeof fd === "number") invalidate(fd);
  }
}

function shareHandles(list: unknown): void {
  if (!Array.isArray(list) || types.isProxy(list)) return;
  for (let index = 0; index < list.length; index++) {
    const item = field(list, index);
    const fd = handleDescriptor(item);
    if (fd !== undefined) invalidate(fd);
    else if (
      item &&
      typeof item === "object" &&
      !types.isAnyArrayBuffer(item) &&
      !(item instanceof MessagePort)
    )
      opaqueDescriptorAccess();
  }
}

/** Sharing invalidates cursor assumptions; it never changes the helper or worker call. */
export function observeDescriptorSharing(): void {
  const watchdog = new URL("./parent-watchdog.js", import.meta.url).href;
  const consumerPreloads = [
    ...process.execArgv,
    process.env.NODE_OPTIONS ?? "",
  ].some((value) =>
    /--(?:import|loader|experimental-loader|require)|(?:^|[\s"'])-r/.test(
      value,
    ),
  );
  Object.defineProperty(workerThreads, "Worker", {
    value: new Proxy(workerThreads.Worker, {
      construct(target, args, newTarget) {
        const file: unknown = args[0];
        const trusted =
          !consumerPreloads &&
          !types.isProxy(file) &&
          file instanceof URL &&
          Object.getPrototypeOf(file) === URL.prototype &&
          !Object.hasOwn(file, "href") &&
          file.href === watchdog;
        if (!trusted) opaqueDescriptorAccess();
        return Reflect.construct(target, args, newTarget);
      },
    }),
  });
  const register = nodeModule.register;
  Object.defineProperty(nodeModule, "register", {
    value: function (this: unknown, ...args: unknown[]) {
      opaqueDescriptorAccess();
      return Reflect.apply(register, this, args);
    },
  });
  const prototype = childProcess.ChildProcess.prototype;
  const spawn: unknown = Reflect.get(prototype, "spawn");
  if (typeof spawn === "function")
    Object.defineProperty(prototype, "spawn", {
      value: function (this: unknown, ...args: unknown[]) {
        shareStdio(args[0]);
        return Reflect.apply(spawn, this, args);
      },
    });
  for (const name of ["spawnSync", "execFileSync", "execSync"] as const) {
    const original = childProcess[name];
    Object.defineProperty(childProcess, name, {
      value: function (this: unknown, ...args: unknown[]) {
        for (const value of args) shareStdio(value);
        return Reflect.apply(original, this, args);
      },
    });
  }
  const postMessage = MessagePort.prototype.postMessage;
  Object.defineProperty(MessagePort.prototype, "postMessage", {
    value: function (this: MessagePort, ...args: unknown[]) {
      shareHandles(args[1]);
      return Reflect.apply(postMessage, this, args);
    },
  });
  const clone = globalThis.structuredClone;
  Object.defineProperty(globalThis, "structuredClone", {
    value: function (...args: unknown[]) {
      shareHandles(field(args[1], "transfer"));
      return Reflect.apply(clone, globalThis, args);
    },
  });
  for (const name of ["dlopen", "binding"] as const) {
    const original: unknown = Reflect.get(process, name);
    if (typeof original !== "function") continue;
    Object.defineProperty(process, name, {
      value: function (this: unknown, ...args: unknown[]) {
        if (name === "dlopen" || args[0] === "fs") opaqueDescriptorAccess();
        return Reflect.apply(original, this, args);
      },
    });
  }
  syncBuiltinESMExports();
}
