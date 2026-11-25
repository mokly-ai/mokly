import { AsyncLocalStorage } from "node:async_hooks";
import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import type { Generation } from "./bundle.js";
import { dependencyDirectory } from "./importer-resolution.js";
import { inside, repositoryOwned } from "./path-scope.js";
import { FreshViteWorker } from "./vite-errors.js";

const active = new AsyncLocalStorage<Generation | undefined>();
const loadedFiles = new Map<string, string | null>();
const loadedDirectories = new Map<string, string>();
let loadedPeers: string | undefined;
let installed = false;

/** Admit a generation before it can populate the process-wide Node caches. */
export function retainViteNodeInputs(
  generation: Generation,
  sourceRoot: string,
): void {
  const { peers, inputs, inputDirectories } = generation.compiled;
  const selectedPeers = JSON.stringify(Object.entries(peers).sort());
  if (loadedPeers !== undefined && loadedPeers !== selectedPeers)
    throw new FreshViteWorker();

  const nodeInput = ([file]: [string, unknown]) =>
    !repositoryOwned(sourceRoot, generation.dependencyRoots, file);
  const files = Object.entries(inputs).filter(nodeInput);
  const directories = Object.entries(inputDirectories)
    .filter(nodeInput)
    .map(([directory, names]) => [directory, JSON.stringify(names)] as const);
  if (
    files.some(([file, digest]) => conflicts(loadedFiles, file, digest)) ||
    directories.some(([file, names]) =>
      conflicts(loadedDirectories, file, names),
    )
  )
    throw new FreshViteWorker();

  loadedPeers = selectedPeers;
  for (const [file, digest] of files) loadedFiles.set(file, digest);
  for (const [directory, names] of directories)
    loadedDirectories.set(directory, names);
}

function conflicts(
  loaded: ReadonlyMap<string, string | null>,
  file: string,
  current: string | null,
): boolean {
  const prior = loaded.get(file);
  return prior !== undefined && prior !== current;
}

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
