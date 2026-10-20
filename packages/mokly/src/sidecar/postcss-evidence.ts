import { createHash } from "node:crypto";
import fs from "node:fs";
import promises from "node:fs/promises";
import nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PostcssEvidence } from "../generated/sidecar/PostcssEvidence.js";
import type { PostcssFileIdentity } from "../generated/sidecar/PostcssFileIdentity.js";
import type { PostcssRead } from "../generated/sidecar/PostcssRead.js";

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
  if (moduleHooksInstalled || typeof nodeModule.registerHooks !== "function")
    return;
  moduleHooksInstalled = true;
  let customized = !earlyReaders && preloadedCode;
  nodeModule.registerHooks({
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
        return Reflect.apply(original, nodeModule, args);
      },
    });
  }
  nodeModule.syncBuiltinESMExports();
}

/** A context remains incomplete even when every listed path has an observed read. */
export function readEvidence(loaded: Iterable<string>): PostcssEvidence {
  for (const file of loaded) modules.add(file);
  for (const file of Object.keys(require.cache))
    if (!initialModules.has(file)) modules.add(file);
  return {
    coverage: "incomplete",
    modules: [...modules],
    reads: [...reads.values(), ...ranges.values()],
  };
}
