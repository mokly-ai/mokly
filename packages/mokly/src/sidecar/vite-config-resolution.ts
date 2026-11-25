import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { createRequire, isBuiltin, registerHooks } from "node:module";
import type { ResolveHookSync } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { missingFile } from "./file-digests.js";
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

/** Record native setup file digests when Node resolves them. */
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

function recordLocalModule(url: string): void {
  const scope = active.getStore();
  if (!scope?.reads || !url.startsWith("file:")) return;
  const file = fileURLToPath(url);
  if (!scope.lookup.paths.repositoryOwned(file)) return;

  let digest: string | undefined;
  try {
    if (fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
      const bytes = fs.readFileSync(file, {
        flag: fs.constants.O_RDONLY | fs.constants.O_NONBLOCK,
      });
      digest = createHash("sha256").update(bytes).digest("hex");
    }
  } catch (error) {
    if (!missingFile(error)) throw error;
  }
  scope.reads.record(file, digest);
}
