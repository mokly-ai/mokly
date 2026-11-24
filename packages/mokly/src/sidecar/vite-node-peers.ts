import { AsyncLocalStorage } from "node:async_hooks";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Generation } from "./bundle.js";
import { dependencyDirectory } from "./importer-resolution.js";
import { inside } from "./path-scope.js";

const active = new AsyncLocalStorage<Generation | undefined>();
let installed = false;

/** Native dependency imports and lazy requires share this generation's peers. */
export function withViteNodePeers<T>(
  generation: Generation | undefined,
  run: () => T,
): T {
  if (!generation?.compiled.vite) return active.run(undefined, run);
  if (!installed) {
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const generation = active.getStore();
        if (
          !generation ||
          !/^(react|react-dom)(?:\/|$)/.test(specifier) ||
          !dependencyParent(generation, context.parentURL)
        )
          return nextResolve(specifier, context);
        const peer = generation.compiled.peers[specifier];
        if (typeof peer !== "string")
          throw Object.assign(
            new Error(
              `could not resolve ${specifier} under the selected dependency policy`,
            ),
            { code: "MODULE_NOT_FOUND" },
          );
        return { url: pathToFileURL(peer).href, shortCircuit: true };
      },
    });
    installed = true;
  }
  return active.run(generation, run);
}

function dependencyParent(
  generation: Generation,
  parent: string | undefined,
): boolean {
  if (!parent?.startsWith("file:")) return false;
  const file = fileURLToPath(parent);
  return (
    generation.dependencyRoots.some((root) => inside(root, file)) ||
    dependencyDirectory(generation.params.sourceRoot, file) !== undefined ||
    dependencyDirectory(
      generation.params.moduleResolution.dependencyRoot,
      file,
    ) !== undefined
  );
}
