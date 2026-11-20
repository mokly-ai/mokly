import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire, isBuiltin, registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import { bareSpecifier } from "./specifier.js";
import type { ViteLookup } from "./vite-resolution.js";

const active = new AsyncLocalStorage<ViteLookup>();
let installed = false;

/** Config imports and synchronous requires use the compile's lookup order. */
export function withViteConfigResolution<T>(
  lookup: ViteLookup,
  run: () => T,
): T {
  if (!installed) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const lookup = active.getStore();
        if (
          !lookup ||
          !bareSpecifier(specifier) ||
          isBuiltin(specifier) ||
          !context.parentURL?.startsWith("file:")
        )
          return nextResolve(specifier, context);
        const url = lookup.sync(
          specifier,
          fileURLToPath(context.parentURL),
          (source, parentURL) =>
            active.exit(() =>
              context.conditions.includes("require")
                ? pathToFileURL(createRequire(parentURL).resolve(source)).href
                : nextResolve(source, { ...context, parentURL }).url,
            ),
        );
        return { url, shortCircuit: true };
      },
    });
    installed = true;
  }
  return active.run(lookup, run);
}
