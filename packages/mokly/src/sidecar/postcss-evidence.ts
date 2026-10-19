import { createHash } from "node:crypto";
import fs from "node:fs";
import nodeModule from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { PostcssEvidence } from "../generated/sidecar/PostcssEvidence.js";

const reads = new Map<string, Set<string>>();
const modules = new Set<string>();
const originalRead = fs.readFileSync;
const require = nodeModule.createRequire(import.meta.url);
const initialModules = new Set(Object.keys(require.cache));

/** Only equal witnessed versions coalesce; a conflicting version remains evidence. */
export function observeBytes(file: string, bytes: Uint8Array): void {
  const name = path.resolve(file);
  const digest = createHash("sha256").update(bytes).digest("hex");
  let versions = reads.get(name);
  if (!versions) reads.set(name, (versions = new Set()));
  versions.add(digest);
}

/** Supply the very buffer whose digest enters the ledger, before compilation. */
export function moduleBytes(file: string): Buffer {
  const bytes = originalRead(file);
  modules.add(file);
  observeBytes(file, bytes);
  return bytes;
}

/** Keep native resolution, conditions, attributes, and cache identity unchanged. */
export function observeModuleLoads(): void {
  if (typeof nodeModule.registerHooks !== "function") return;
  let customized = [...process.execArgv, process.env.NODE_OPTIONS ?? ""].some(
    (value) =>
      /--(?:import|loader|experimental-loader|require)|(?:^|[\s"'])-r/.test(
        value,
      ),
  );
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
  for (const name of ["register", "registerHooks"] as const) {
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
    reads: [...reads].flatMap(([path, versions]) =>
      [...versions].map((digest) => ({ kind: "whole-file", path, digest })),
    ),
  };
}
