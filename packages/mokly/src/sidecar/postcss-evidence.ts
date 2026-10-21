import { createHash } from "node:crypto";
import fs from "node:fs";
import promises from "node:fs/promises";
import nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MessageChannel } from "node:worker_threads";
import type { MessagePort } from "node:worker_threads";

import type { PostcssEvidence } from "../generated/sidecar/PostcssEvidence.js";
import type { PostcssFileIdentity } from "../generated/sidecar/PostcssFileIdentity.js";
import type { PostcssRead } from "../generated/sidecar/PostcssRead.js";

import { resolutionMetadata } from "./postcss-resolution-evidence.js";

const reads = new Map<string, PostcssRead>();
const ranges = new Map<string, PostcssRead>();
const modules = new Set<string>();
const originalRead = fs.readFileSync;
const originalPromiseRead = promises.readFile;
let physicalReader = originalPromiseRead;
const require = nodeModule.createRequire(import.meta.url);
const initialModules = new Set(Object.keys(require.cache));
type FileReader = typeof fs.readFileSync | typeof promises.readFile;
const observedReaders = new WeakSet<FileReader>();
let earlyReaders = false;
let moduleHooksInstalled = false;
const observerKey = Symbol.for("mokly.postcss.readEvidence");
const modulePathKey = Symbol.for("mokly.postcss.modulePath");
type Observer = (loaded: Iterable<string>) => PostcssEvidence;
type ModulePathRecorder = (url: string) => void;

function isModulePathRecorder(value: unknown): value is ModulePathRecorder {
  return typeof value === "function";
}
let asyncHookInstalled = false;
let asyncHookRegistering = false;
let asyncHookActive = false;
let asyncPathsPort: MessagePort | undefined;
let asyncFlushId = 0;
const pendingAsyncFlushes = new Map<number, () => void>();

function isObserver(value: unknown): value is Observer {
  return typeof value === "function";
}

/** A CommonJS preload and the ESM worker share one installed observer. */
export function preloadedObserver(): Observer | undefined {
  const value: unknown = Reflect.get(globalThis, observerKey);
  return isObserver(value) && value !== readEvidence ? value : undefined;
}

export function shareReadEvidence(): void {
  Object.defineProperty(globalThis, observerKey, { value: readEvidence });
  Object.defineProperty(globalThis, modulePathKey, { value: recordModulePath });
}

/** Record file URLs resolved by an asynchronous consumer loader. */
export function observeAsyncModuleLoads(): void {
  if (
    (!asynchronousLoader && !consumerImport) ||
    asyncHookInstalled ||
    typeof nodeModule.register !== "function"
  )
    return;
  asyncHookInstalled = true;
  const original = nodeModule.register;
  Object.defineProperty(nodeModule, "register", {
    value: function (...args: unknown[]): unknown {
      const result = Reflect.apply(original, nodeModule, args as never);
      if (!asyncHookRegistering) registerAsyncHook();
      return result;
    },
  });
  if (asynchronousLoader) registerAsyncHook();
}

/** Let loader-thread messages arrive before the result frame is sent. */
export async function flushAsyncModulePaths(): Promise<void> {
  if (!asyncHookActive || !asyncPathsPort) return;
  const id = ++asyncFlushId;
  await new Promise<void>((resolve) => {
    pendingAsyncFlushes.set(id, resolve);
    asyncPathsPort?.postMessage({ kind: "flush", id });
  });
}

function registerAsyncHook(): void {
  if (asyncHookRegistering) return;
  asyncHookRegistering = true;
  asyncHookActive = true;
  const { port1, port2 } = new MessageChannel();
  asyncPathsPort = port1;
  port1.on("message", (message: unknown) => {
    if (
      message &&
      typeof message === "object" &&
      "kind" in message &&
      message.kind === "flushed" &&
      "id" in message &&
      typeof message.id === "number"
    ) {
      pendingAsyncFlushes.get(message.id)?.();
      pendingAsyncFlushes.delete(message.id);
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
    for (const resolve of pendingAsyncFlushes.values()) resolve();
    pendingAsyncFlushes.clear();
  });
  port1.unref();
  try {
    nodeModule.register("./postcss-async-loader.mjs", {
      parentURL: import.meta.url,
      data: { paths: port2 },
      transferList: [port2],
    });
  } finally {
    asyncHookRegistering = false;
  }
}

/** Add a resolved file URL to the current module inventory. */
export function recordModulePath(url: string): void {
  if (!url.startsWith("file:")) return;
  const recorder: unknown = Reflect.get(globalThis, modulePathKey);
  if (isModulePathRecorder(recorder) && recorder !== recordModulePath) {
    recorder(url);
    return;
  }
  try {
    modules.add(fileURLToPath(url));
  } catch {
    /* A malformed loader URL cannot be a module input. */
  }
}

/** Async loaders cannot certify raw source or synchronously load an ESM preload. */
export const asynchronousLoader = [
  ...process.execArgv,
  process.env.NODE_OPTIONS ?? "",
].some((value) => /--(?:experimental-)?loader(?:=|\s|$)/.test(value));

const consumerImport = [
  ...process.execArgv,
  process.env.NODE_OPTIONS ?? "",
].some((value) => /--import(?:=|\s|$)/.test(value));

/** The first child preload obtains native readers before consumer replacement. */
export function trustEarlyReaders(): void {
  earlyReaders = true;
}

/** Preloads can replace file APIs before this child can observe their raw inputs. */
export const preloadedCode = [
  ...process.execArgv,
  process.env.NODE_OPTIONS ?? "",
].some((value) =>
  /--(?:import|loader|experimental-loader|require)|(?:^|[\s"'])-r/.test(value),
);

/** Only equal witnessed versions coalesce; a conflicting version remains evidence. */
export function observeBytes(
  file: string,
  bytes: Uint8Array,
  identity?: PostcssFileIdentity,
): void {
  const name = path.resolve(file);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const record: PostcssRead = {
    kind: "whole-file",
    path: name,
    digest,
    ...(identity ? { identity } : {}),
  };
  reads.set(JSON.stringify(record), record);
}

/** Ranges retain their offsets and never become whole-file digests. */
export function observeRange(
  file: string,
  offset: number,
  bytes: Uint8Array,
  eof = false,
  identity?: PostcssFileIdentity,
): void {
  if (!Number.isSafeInteger(offset) || offset < 0 || (!bytes.length && !eof))
    return;
  const record: PostcssRead = {
    kind: "byte-range",
    path: path.resolve(file),
    digest: createHash("sha256").update(bytes).digest("hex"),
    offset,
    length: bytes.length,
    eof,
    ...(identity ? { identity } : {}),
  };
  ranges.set(JSON.stringify(record), record);
}

/** Supply compiler bytes; only native file providers establish raw provenance. */
export function moduleBytes(file: string): Buffer | string {
  const reader = fs.readFileSync;
  const invoke = reader.bind(fs);
  const bytes = rawReader(reader, originalRead)
    ? invoke(file)
    : invoke(file, "utf8");
  return compilerBytes(file, bytes, reader === originalRead);
}

/** Script inputs preserve async provider behavior; default assets use physical reads. */
export async function moduleBytesAsync(
  file: string,
  physicalFile = false,
): Promise<Buffer | string> {
  const reader = physicalFile ? physicalReader : promises.readFile;
  const invoke = reader.bind(promises);
  return compilerBytes(
    file,
    await (rawReader(reader, originalPromiseRead)
      ? invoke(file)
      : invoke(file, "utf8")),
    reader === originalPromiseRead,
  );
}

/** Only Mokly's own wrappers can certify the raw read below a text conversion. */
export function markFileReader(reader: FileReader): void {
  observedReaders.add(reader);
  if (reader === promises.readFile) physicalReader = reader;
}

function rawReader(reader: FileReader, original: FileReader): boolean {
  return (
    (earlyReaders || !preloadedCode) &&
    (reader === original || observedReaders.has(reader))
  );
}

function compilerBytes(
  file: string,
  bytes: Buffer | string,
  nativeProvider: boolean,
): Buffer | string {
  modules.add(file);
  if (
    (earlyReaders || !preloadedCode) &&
    nativeProvider &&
    Buffer.isBuffer(bytes)
  )
    observeBytes(file, bytes);
  return bytes;
}

/** Keep native resolution, conditions, attributes, and cache identity unchanged. */
export function observeModuleLoads(): void {
  if (
    moduleHooksInstalled ||
    asynchronousLoader ||
    typeof nodeModule.registerHooks !== "function"
  )
    return;
  moduleHooksInstalled = true;
  let customized = !earlyReaders && preloadedCode;
  const hooks = nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      for (const file of resolutionMetadata(
        specifier,
        context.parentURL,
        result.url,
      ))
        modules.add(file);
      return result;
    },
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      if (!url.startsWith("file:")) return result;
      const file = fileURLToPath(url);
      modules.add(file);
      if (customized) return result;
      if (ArrayBuffer.isView(result.source)) {
        observeBytes(
          file,
          new Uint8Array(
            result.source.buffer,
            result.source.byteOffset,
            result.source.byteLength,
          ),
        );
      } else if (result.source instanceof ArrayBuffer) {
        observeBytes(file, new Uint8Array(result.source));
      }
      return result;
    },
  });
  for (const name of ["register"] as const) {
    const original = nodeModule[name];
    Object.defineProperty(nodeModule, name, {
      value: function (...args: unknown[]): unknown {
        customized = true;
        hooks.deregister();
        return Reflect.apply(original, nodeModule, args);
      },
    });
  }
  nodeModule.syncBuiltinESMExports();
}

/** A context remains incomplete even when every listed path has an observed read. */
export function readEvidence(loaded: Iterable<string>): PostcssEvidence {
  const observer = preloadedObserver();
  if (observer) return observer([...loaded, ...modules]);
  for (const file of loaded) modules.add(file);
  for (const file of Object.keys(require.cache))
    if (!initialModules.has(file)) modules.add(file);
  return {
    coverage: "incomplete",
    modules: [...modules],
    reads: [...reads.values(), ...ranges.values()],
  };
}
