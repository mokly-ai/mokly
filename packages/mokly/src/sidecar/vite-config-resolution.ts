import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { createRequire, isBuiltin, registerHooks } from "node:module";
import type { ModuleSource, ResolveHookSync } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { bareSpecifier } from "./specifier.js";
import type { ViteLookup } from "./vite-resolution.js";
import type { ConfigReads } from "./vite-setup-input.js";

interface Scope {
  lookup: ViteLookup;
  reads?: ConfigReads;
}

const active = new AsyncLocalStorage<Scope>();
const parentNamespace = "vite-module-runner:import-meta-resolve/v1/";
let installed = false;

/** Pass the author's parent URL to Node with the original import conditions. */
export function viteConfigSpecifier(specifier: string, parent: string): string {
  return parentNamespace + JSON.stringify([specifier, parent]);
}

export function viteConfigLookup(): ViteLookup | undefined {
  return active.getStore()?.lookup;
}

/** Use the same package lookup when Vite runs a hook after the config loads. */
export function withViteConfigResolution<T>(
  lookup: ViteLookup | undefined,
  run: () => T,
): T {
  installHooks();
  if (!lookup || viteConfigLookup() === lookup) return run();
  return active.run({ lookup }, run);
}

/** Observe native files resolved during setup, with their load-time bytes. */
export async function recordViteConfigResolution<T>(
  lookup: ViteLookup,
  reads: ConfigReads,
  run: () => Promise<T>,
): Promise<T> {
  installHooks();
  const scope: Scope = { lookup, reads };
  try {
    return await active.run(scope, run);
  } finally {
    delete scope.reads;
  }
}

function installHooks(): void {
  if (installed) return;
  registerHooks({
    resolve(specifier, context, nextResolve) {
      const result = resolveConfigModule(specifier, context, nextResolve);
      recordLocalModule(result.url);
      return result;
    },
    load(url, context, nextLoad) {
      const result = nextLoad(url, context);
      recordLocalModule(url, result.shortCircuit ? undefined : result.source);
      return result;
    },
  });
  installed = true;
}

const resolveConfigModule: ResolveHookSync = (
  specifier,
  context,
  nextResolve,
) => {
  if (specifier.startsWith(parentNamespace)) {
    const request: unknown = JSON.parse(
      specifier.slice(parentNamespace.length),
    );
    if (
      Array.isArray(request) &&
      typeof request[0] === "string" &&
      typeof request[1] === "string"
    ) {
      specifier = request[0];
      context = { ...context, parentURL: request[1] };
    }
  }
  const scope = active.getStore();
  if (
    !scope ||
    !bareSpecifier(specifier) ||
    isBuiltin(specifier) ||
    !context.parentURL?.startsWith("file:")
  )
    return nextResolve(specifier, context);
  const importer = fileURLToPath(context.parentURL);
  if (!scope.reads && !scope.lookup.paths.repositoryOwned(importer))
    return nextResolve(specifier, context);
  const url = scope.lookup.sync(specifier, importer, (source, parentURL) =>
    active.exit(() =>
      Array.from(context.conditions).includes("require")
        ? pathToFileURL(createRequire(parentURL).resolve(source)).href
        : nextResolve(source, { ...context, parentURL }).url,
    ),
  );
  return { url, shortCircuit: true };
};

function recordLocalModule(url: string, source?: ModuleSource): void {
  const scope = active.getStore();
  if (!scope?.reads || !url.startsWith("file:")) return;
  const file = fileURLToPath(url);
  if (scope.lookup.paths.repositoryOwned(file))
    scope.reads.record(file, sourceDigest(source));
}

function sourceDigest(source: ModuleSource | undefined): string | undefined {
  if (typeof source === "string") {
    // Node reads CommonJS as UTF-8. A replacement character can hide the original bytes.
    if (!source.includes("\uFFFD"))
      return createHash("sha256").update(source).digest("hex");
    return;
  }
  const bytes = ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : source instanceof ArrayBuffer
      ? new Uint8Array(source)
      : undefined;
  if (bytes) return createHash("sha256").update(bytes).digest("hex");
}
