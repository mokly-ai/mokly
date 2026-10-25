import nodeModule from "node:module";

import { recordModulePath } from "./postcss-evidence.js";

let installed = false;

/** Keep path observation outside consumer hooks without witnessing their bytes. */
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
