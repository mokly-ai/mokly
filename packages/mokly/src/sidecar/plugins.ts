import fs from "node:fs/promises";
import path from "node:path";

import type { Loader, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import type { VirtualOrigin } from "./bundle-errors.js";
import { cssModulePrefix } from "./css-modules.js";
import { detail } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import type { ConsumerRequire } from "./paths.js";
import { styleAdaptersPlugin } from "./style-adapters-plugin.js";

export interface BundleInputs {
  files: Map<string, Uint8Array>;
  cssModules: Set<string>;
  virtualOrigins: Map<string, VirtualOrigin>;
}

export function consumerPlugins(
  params: BundleParams,
  inputs: BundleInputs,
  require: ConsumerRequire,
  paths: ModulePaths,
  runtimeKey = "mokly:runtime",
): Plugin[] {
  const root = params.sourceRoot;
  const ownPackage = path.resolve(import.meta.dirname, "../..");
  return [
    require.peerPlugin,
    styleAdaptersPlugin(params, inputs.virtualOrigins),
    {
      name: "mokly-consumer",
      setup(build) {
        build.onLoad({ filter: /.*/, namespace: "file" }, async (args) => {
          if (
            params.moduleResolution.loaders[path.extname(args.path)] === "file"
          )
            throw new Error(
              `consumer graph emitted an undelivered file: ${logical(root, args.path)}; use a dataurl or binary loader for JavaScript assets instead of file`,
            );
          const extension = path.extname(args.path);
          const loader =
            params.moduleResolution.loaders[extension] ??
            sourceLoaders[extension] ??
            attributeLoaders[args.with.type ?? ""] ??
            (extension === ".txt" ? "text" : undefined);
          if (!loader) return undefined;
          const contents =
            inputs.files.get(args.path) ?? (await fs.readFile(args.path));
          inputs.files.set(args.path, contents);
          return { contents, loader: loader as Loader };
        });
        build.onResolve({ filter: /^@mokly\/mokly$/ }, async (args) => {
          const importer =
            args.importer &&
            (await fs.realpath(args.importer).catch(() => args.importer));
          const attributed =
            importer &&
            paths.repositoryOwned(importer) &&
            !inside(ownPackage, importer);
          return {
            path: JSON.stringify(attributed ? logical(root, importer) : null),
            namespace: "mokly-authoring",
          };
        });
        build.onLoad(
          { filter: /.*/, namespace: "mokly-authoring" },
          (args) => ({
            contents: `const api = require("mokly:runtime").authoring(${args.path === "null" ? "undefined" : args.path});
        export const {defineScreen,defineComponent,definePage,defineUseCase,defineFolder,
          MockLink,mockLink,ReviewIgnore,ReviewIgnoreScope,reviewMaterialKey} = api;`,
            loader: "js",
          }),
        );
        build.onResolve({ filter: /^mokly:runtime$/ }, (args) => {
          if (
            !["mokly-authoring", "mokly-css", "mokly-style"].includes(
              args.namespace,
            )
          )
            return {
              errors: [{ text: "Mokly's generation runtime is reserved" }],
            };
          return { path: runtimeKey, external: true };
        });
        build.onResolve({ filter: /^mokly:css-map:/ }, (args) => {
          if (args.namespace !== "mokly-css")
            return {
              errors: [{ text: "Mokly's generation runtime is reserved" }],
            };
          return { path: runtimeKey + args.path, external: true };
        });
        build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
          path: "jsx",
          namespace: "mokly-jsx",
        }));
        build.onLoad({ filter: /.*/, namespace: "mokly-jsx" }, () => ({
          contents: `import { jsx, jsxs, Fragment } from "react/jsx-runtime";
        import { resolve } from "node:path";
        export { Fragment };
        export function jsxDEV(type, props, key, staticChildren, source) {
          if (type && type[Symbol.for("mokly.component")] && source)
            props = {...props, __moklySource: {...source, fileName: resolve(${JSON.stringify(path.resolve(root, params.configurationDirectory))}, source.fileName)}};
          return (staticChildren ? jsxs : jsx)(type, props, key);
        }`,
          resolveDir: root,
          loader: "js",
        }));
        build.onResolve(
          { filter: /^(react|react-dom)(\/.*)?$/ },
          async (args) => {
            if (args.pluginData === "consumer-peer") return;
            try {
              return {
                path: await require.resolvePeer(args.path),
                external: true,
              };
            } catch (error) {
              return { errors: [{ text: detail(error) }] };
            }
          },
        );
        build.onResolve({ filter: /\.css$/ }, async (args) => {
          if (args.pluginData === "css-resolved") return;
          const resolved = await build.resolve(args.path, {
            resolveDir: args.resolveDir,
            kind: args.kind,
            pluginData: "css-resolved",
          });
          if (resolved.errors.length) return { errors: resolved.errors };
          try {
            const file = await paths.resolve(resolved.path);
            await paths.dependencyUsage.resolved(
              args.path,
              args.resolveDir,
              file,
            );
            return { path: file, namespace: "mokly-css" };
          } catch (error) {
            return { errors: [{ text: detail(error) }] };
          }
        });
        build.onResolve({ filter: /.*/ }, async (args) => {
          if (
            ["repository-resolved", "css-resolved", "consumer-peer"].includes(
              args.pluginData,
            ) ||
            !["file", ""].includes(args.namespace)
          )
            return;
          const resolved = await build.resolve(args.path, {
            resolveDir: args.resolveDir,
            importer: args.importer,
            kind: args.kind,
            pluginData: "repository-resolved",
          });
          if (
            resolved.errors.length ||
            resolved.external ||
            resolved.namespace !== "file"
          )
            return resolved;
          try {
            const file = await paths.resolve(resolved.path);
            await paths.dependencyUsage.resolved(
              args.path,
              args.resolveDir,
              file,
            );
            return { ...resolved, path: file };
          } catch (error) {
            return { errors: [{ text: detail(error) }] };
          }
        });
        build.onLoad({ filter: /.*/, namespace: "mokly-css" }, async (args) => {
          const file = paths.name(args.path);
          inputs.files.set(
            args.path,
            inputs.files.get(args.path) ?? (await fs.readFile(args.path)),
          );
          const module = args.path.endsWith(".module.css");
          const loaders = params.moduleResolution.loaders;
          const empty =
            loaders[".css"] === "empty" ||
            (module && loaders[".module.css"] === "empty");
          if (empty || !module)
            return { contents: "export default {};", loader: "js" };
          inputs.cssModules.add(file);
          return {
            contents: `export default require("mokly:runtime").css(${JSON.stringify(file)});\nexport * from ${JSON.stringify(cssModulePrefix + file)};`,
            loader: "js",
          };
        });
      },
    },
  ];
}

const sourceLoaders: Record<string, Loader> = {
  "": "js",
  ".js": "js",
  ".mjs": "js",
  ".cjs": "js",
  ".jsx": "jsx",
  ".ts": "ts",
  ".mts": "ts",
  ".cts": "ts",
  ".tsx": "tsx",
  ".json": "json",
};

const attributeLoaders: Record<string, Loader> = {
  json: "json",
  text: "text",
  bytes: "binary",
};
