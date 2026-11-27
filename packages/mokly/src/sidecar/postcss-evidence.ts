/**
 * Read evidence of the PostCSS worker's current generation. Each observed read
 * digests the raw bytes before BOM handling or decoding: compiler inputs, JSON
 * and configured loaders included, native module source buffers, and the
 * path, descriptor, `FileHandle` and stream reads that the preload wraps.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import promises from "node:fs/promises";
import nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PostcssEvidence } from "../generated/sidecar/PostcssEvidence.js";
import type { PostcssFileIdentity } from "../generated/sidecar/PostcssFileIdentity.js";
import type { PostcssRead } from "../generated/sidecar/PostcssRead.js";

import {
  asynchronousLoader,
  mixedLoadHooksSupported,
  preloadedCode,
} from "./postcss-loader-options.js";
import { resolutionMetadata } from "./postcss-resolution-evidence.js";

const reads = new Map<string, PostcssRead>();
const ranges = new Map<string, PostcssRead>();
const modules = new Set<string>();
const loadedModules = new Set<string>();
let activeGeneration: string | undefined;
const originalRead = fs.readFileSync;
const originalPromiseRead = promises.readFile;
let physicalReader = originalPromiseRead;
const require = nodeModule.createRequire(import.meta.url);
let moduleBaseline = new Set(Object.keys(require.cache));
type FileReader = typeof fs.readFileSync | typeof promises.readFile;
const observedReaders = new WeakSet<FileReader>();
let earlyReaders = false;
let moduleHooksInstalled = false;
let registeredAsynchronousLoader = false;
const moduleUrlObservers = new Set<(url: string) => void>();
const ledgerKey = Symbol.for("mokly.postcss.ledger");
type Observer = (loaded: Iterable<string>) => PostcssEvidence;

/** The operations that the CommonJS preload shares with the ESM worker. */
export interface Ledger {
  readEvidence: Observer;
  loadedModules: ReadonlySet<string>;
  asynchronousLoader: boolean;
  resetGeneration: (generation: string) => void;
  initializeGeneration: (generation: string) => void;
}

const ledger: Readonly<Ledger> = Object.freeze({
  readEvidence,
  loadedModules,
  get asynchronousLoader() {
    return asynchronousLoader || registeredAsynchronousLoader;
  },
  resetGeneration: resetReadEvidence,
  initializeGeneration: markGeneration,
});

/** The preload's ledger, when this copy runs beside the CommonJS preload. */
function sharedLedger(): Ledger | undefined {
  const value = Reflect.get(globalThis, ledgerKey) as Ledger | undefined;
  return value !== ledger ? value : undefined;
}

/** A CommonJS preload and the ESM worker share one installed observer. */
export function preloadedObserver(): Observer | undefined {
  return sharedLedger()?.readEvidence;
}

export function shareReadEvidence(): void {
  Object.defineProperty(globalThis, ledgerKey, { value: ledger });
}

/** Keep only witnesses observed after the current generation starts. */
export function beginReadEvidenceGeneration(generation: string): void {
  (sharedLedger() ?? ledger).resetGeneration(generation);
}

function resetReadEvidence(generation: string): void {
  if (generation === activeGeneration) return;
  activeGeneration = generation;
  reads.clear();
  ranges.clear();
  modules.clear();
  moduleBaseline = new Set(Object.keys(require.cache));
}

/** Mark the worker's first generation without dropping preload observations. */
export function initializeReadEvidenceGeneration(generation: string): void {
  (sharedLedger() ?? ledger).initializeGeneration(generation);
}

function markGeneration(generation: string): void {
  activeGeneration = generation;
}

/** Add a resolved file URL to the current module inventory. */
export function recordModulePath(url: string, loaded = false): void {
  if (!url.startsWith("file:")) return;
  try {
    const file = fileURLToPath(url);
    modules.add(file);
    if (loaded) loadedModules.add(file);
  } catch {
    /* A malformed loader URL cannot be a module input. */
  }
}

/** Executed native modules can stay loaded across generation resets. */
export function loadedModulePaths(): Iterable<string> {
  return [...loadedModules, ...(sharedLedger()?.loadedModules ?? [])];
}

export function hasAsynchronousLoader(): boolean {
  return (sharedLedger() ?? ledger).asynchronousLoader;
}

/** The first child preload obtains native readers before consumer replacement. */
export function trustEarlyReaders(): void {
  earlyReaders = true;
}

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
export function observeModuleLoads(
  onModuleUrl: (url: string) => void = () => {},
): void {
  moduleUrlObservers.add(onModuleUrl);
  if (
    moduleHooksInstalled ||
    asynchronousLoader ||
    (!mixedLoadHooksSupported && hasAsynchronousLoader()) ||
    typeof nodeModule.registerHooks !== "function"
  )
    return;
  moduleHooksInstalled = true;
  let customized = !earlyReaders && preloadedCode;
  const hooks = nodeModule.registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = nextResolve(specifier, context);
      if (typeof result.url === "string")
        for (const observer of moduleUrlObservers) observer(result.url);
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
      for (const observer of moduleUrlObservers) observer(url);
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
        registeredAsynchronousLoader = true;
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
    if (!moduleBaseline.has(file)) modules.add(file);
  return {
    coverage: "incomplete",
    modules: [...modules],
    reads: [...reads.values(), ...ranges.values()],
  };
}
