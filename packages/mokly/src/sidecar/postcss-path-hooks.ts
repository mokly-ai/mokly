import nodeModule from "node:module";

import { recordModulePath } from "./postcss-evidence.js";

let installed = false;

/**
 * Keep path observation outside consumer hooks without witnessing their bytes.
 * The resolve hook installs itself again after each `registerHooks` call, so it
 * stays outside every consumer hook. Synchronous hooks also wrap asynchronous
 * loaders, so it reports the modules that those loaders supply, and Mokly
 * registers no asynchronous hook of its own.
 */
export function observeModulePaths(): void {
  if (installed || typeof nodeModule.registerHooks !== "function") return;
  installed = true;
  const register = nodeModule.registerHooks;
  let observer: ReturnType<typeof register> | undefined;
  const install = () => {
    observer?.deregister();
    observer = register({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context);
        recordModulePath(result.url);
        return result;
      },
    });
  };
  Object.defineProperty(nodeModule, "registerHooks", {
    value: (options: Parameters<typeof register>[0]) => {
      const hooks = register(options);
      install();
      return hooks;
    },
  });
  install();
  nodeModule.syncBuiltinESMExports();
}
