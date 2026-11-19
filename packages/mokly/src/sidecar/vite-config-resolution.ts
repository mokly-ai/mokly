import { AsyncLocalStorage } from "node:async_hooks";
import { realpathSync } from "node:fs";
import { createRequire, isBuiltin, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { importerDirectory } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { inside } from "./path-scope.js";
import { bareSpecifier } from "./specifier.js";

const active = new AsyncLocalStorage<ModulePaths>();
let installed = false;

/** Config imports and synchronous requires keep the side's installation lookup. */
export function withViteConfigResolution<T>(
  paths: ModulePaths,
  run: () => T,
): T {
  if (!installed) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const paths = active.getStore();
        if (
          !paths ||
          !bareSpecifier(specifier) ||
          isBuiltin(specifier) ||
          !context.parentURL?.startsWith("file:")
        )
          return nextResolve(specifier, context);
        const importer = fileURLToPath(context.parentURL);
        const directory = path.dirname(importer);
        const selected = importerDirectory(paths, specifier, directory);
        if (selected === directory) return nextResolve(specifier, context);
        try {
          const original = nextResolve(specifier, context);
          if (
            !original.url.startsWith("file:") ||
            inside(paths.sourceRoot, realpathSync(fileURLToPath(original.url)))
          )
            return original;
        } catch (error) {
          if (
            !error ||
            typeof error !== "object" ||
            !("code" in error) ||
            !["MODULE_NOT_FOUND", "ERR_MODULE_NOT_FOUND"].includes(
              String(error.code),
            )
          )
            throw error;
        }
        const parent = pathToFileURL(
          path.join(selected, path.basename(importer)),
        );
        const resolved = context.conditions.includes("require")
          ? {
              url: pathToFileURL(createRequire(parent).resolve(specifier)).href,
              shortCircuit: true,
            }
          : nextResolve(specifier, { ...context, parentURL: parent.href });
        return resolved.url.startsWith("file:")
          ? {
              ...resolved,
              url: pathToFileURL(paths.resolveSync(fileURLToPath(resolved.url)))
                .href,
            }
          : resolved;
      },
    });
    installed = true;
  }
  return active.run(paths, run);
}
