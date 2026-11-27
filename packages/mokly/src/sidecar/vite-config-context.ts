import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  viteConfigLookup,
  viteConfigSpecifier,
  withViteConfigResolution,
} from "./vite-config-resolution.js";

export function context(file: string, format: "esm" | "cjs") {
  const native = createRequire(file);
  const parent = pathToFileURL(file).href;
  const lookup = viteConfigLookup();
  const inSide = <T>(run: () => T) => withViteConfigResolution(lookup, run);
  const target = (name: string) =>
    name.startsWith("file:") ? fileURLToPath(name) : name;
  const require = Object.assign(
    (name: string) => inSide(() => native(target(name))),
    native,
    {
      resolve: Object.assign(
        (name: string, options?: { paths?: string[] }) =>
          inSide(() => native.resolve(target(name), options)),
        native.resolve,
      ),
    },
  );
  return {
    require,
    resolve(value: unknown, importer: string | URL = parent) {
      if (format === "cjs")
        throw new Error(
          "import.meta.resolve is not supported in CJS config files",
        );
      return inSide(() =>
        import.meta.resolve(
          viteConfigSpecifier(String(value), String(importer)),
        ),
      );
    },
    import(value: unknown, options?: ImportCallOptions) {
      return inSide(
        () => import(viteConfigSpecifier(String(value), parent), options),
      );
    },
  };
}
