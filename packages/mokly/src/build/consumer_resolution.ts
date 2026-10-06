import { createRequire } from "node:module";
import path from "node:path";

import type { Plugin, PluginBuild } from "esbuild";

import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { runtimeModule } from "./consumer_entry.js";

/** Resolve React peers from consumer package roots before the executing package. */
export function consumerReactPlugin(config: ResolvedConfig): Plugin {
  const consumerRequires = [
    createRequire(config.configPath),
    ...config.moduleResolution.packageRoots.map((root) =>
      createRequire(path.join(root, "package.json")),
    ),
  ];
  return {
    name: "mokly-single-react",
    setup(pluginBuild: PluginBuild): void {
      pluginBuild.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
        namespace: "mokly-jsx-dev-runtime",
        path: "react/jsx-dev-runtime",
      }));
      pluginBuild.onLoad(
        { filter: /.*/, namespace: "mokly-jsx-dev-runtime" },
        () => ({
          contents: [
            `export { Fragment } from "react/jsx-runtime";`,
            `import { createJsxDEV } from ${JSON.stringify(runtimeModule("./jsx_dev_runtime.js", "./jsx_dev_runtime.ts"))};`,
            `export const jsxDEV = createJsxDEV(${JSON.stringify(path.dirname(config.configPath))}, ${JSON.stringify(config.repoRoot)});`,
          ].join("\n"),
          loader: "js",
          resolveDir: path.dirname(config.configPath),
        }),
      );
      pluginBuild.onResolve(
        { filter: /^(react|react-dom)(\/.*)?$/ },
        (arguments_) => {
          for (const consumerRequire of consumerRequires) {
            try {
              return { path: consumerRequire.resolve(arguments_.path) };
            } catch {
              continue;
            }
          }
          throw new MoklyError(
            "build-invalid",
            `consumer must install peer dependency ${arguments_.path}`,
          );
        },
      );
    },
  };
}

/** Return dependency directories searched after normal importer resolution. */
export function packageNodePaths(config: ResolvedConfig): string[] {
  return [
    path.join(config.repoRoot, "node_modules"),
    ...config.moduleResolution.packageRoots.map((root) =>
      path.join(root, "node_modules"),
    ),
  ];
}
