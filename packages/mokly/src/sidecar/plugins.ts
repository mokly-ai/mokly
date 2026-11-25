import nodeFs from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import type { Loader, OnResolveArgs, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { assetModule, assetType, consumerLoader } from "./asset-imports.js";
import type { VirtualOrigin } from "./bundle-errors.js";
import { detail } from "./errors.js";
import { importPath, resolveImport } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { plannedResult } from "./native-plan.js";
import { importCallbackKey, nativeResolution } from "./native-resolution.js";
import type { Resolution } from "./native-resolution.js";
import type { ConsumerRequire } from "./paths.js";
import { styleAdaptersPlugin } from "./style-adapters-plugin.js";
import {
  authoringModulePath,
  authoringModuleSource,
  cssModuleSource,
  jsxDevelopmentModuleSource,
  runtimeImportAllowed,
} from "./virtual-modules.js";

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
  resolution: Resolution = { mode: "full" },
  reads = inputs.files,
  resolveFilters: readonly RegExp[] = [/.*/],
  handledImports?: Set<string>,
): Plugin[] {
  const root = params.sourceRoot;
  return [
    require.peerPlugin,
    styleAdaptersPlugin(params, inputs.virtualOrigins),
    {
      name: "mokly-consumer",
      setup(build) {
        build.onLoad({ filter: /.*/, namespace: "file" }, async (args) => {
          const type = args.with.type ?? "";
          const attribute = Object.hasOwn(attributeLoaders, type)
            ? attributeLoaders[type]
            : undefined;
          const extension = path.extname(args.path);
          const loader =
            attribute ??
            consumerLoader(args.path, params.moduleResolution.loaders) ??
            sourceLoaders[extension] ??
            (assetType(args.path)
              ? "asset"
              : extension === ".txt"
                ? "text"
                : undefined);
          if (!loader) return undefined;
          if (loader === "file" && !assetType(args.path, loader))
            return {
              errors: [
                {
                  text: `file loader cannot deliver ${paths.name(args.path)}; use a binary or text loader for this type`,
                },
              ],
            };
          let contents = reads.get(args.path);
          if (contents === undefined) {
            try {
              contents = nodeFs.readFileSync(args.path);
            } catch {
              try {
                contents = await new Promise<Buffer>((resolve, reject) => {
                  nodeFs.readFile(args.path, (error, bytes) => {
                    if (error) reject(error);
                    else resolve(bytes);
                  });
                });
              } catch (error) {
                if (error && typeof error === "object")
                  Error.captureStackTrace(error);
                throw error;
              }
            }
            reads.set(args.path, contents);
          }
          inputs.files.set(args.path, contents);
          if (loader === "asset" || loader === "file")
            return {
              contents: assetModule(paths.name(args.path), inputs.files),
              loader: "text",
            };
          return { contents, loader: loader as Loader };
        });
        // A repository-owned importer of `@mokly/mokly` (real path in the
        // repository, outside node_modules, dependency roots and this package)
        // gets a virtual module whose helpers are bound to its logical path,
        // so attribution needs no process-global state. Other importers share
        // the unattributed API.
        build.onResolve({ filter: /^@mokly\/mokly$/ }, async (args) => {
          return {
            path: await authoringModulePath(root, args.importer, paths),
            namespace: "mokly-authoring",
          };
        });
        build.onLoad(
          { filter: /.*/, namespace: "mokly-authoring" },
          (args) => ({
            contents: authoringModuleSource(args.path),
            loader: "js",
          }),
        );
        build.onResolve({ filter: /^mokly:runtime$/ }, (args) => {
          if (!runtimeImportAllowed(args.path, args.namespace))
            return {
              errors: [{ text: "Mokly's generation runtime is reserved" }],
            };
          return { path: runtimeKey, external: true };
        });
        build.onResolve({ filter: /^mokly:css-map:/ }, (args) => {
          if (!runtimeImportAllowed(args.path, args.namespace))
            return {
              errors: [{ text: "Mokly's generation runtime is reserved" }],
            };
          return { path: runtimeKey + args.path, external: true };
        });
        build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, (args) => ({
          path:
            !params.storiesFiles.length || paths.repositoryOwned(args.importer)
              ? "jsx"
              : "dependency",
          namespace: "mokly-jsx",
        }));
        build.onLoad({ filter: /.*/, namespace: "mokly-jsx" }, (args) => ({
          contents: jsxDevelopmentModuleSource(
            root,
            params.configurationDirectory,
            args.path === "jsx" && params.storiesFiles.length > 0,
          ),
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
          const resolved = await resolveImport(paths, build, args.path, {
            resolveDir: args.resolveDir,
            kind: args.kind,
            pluginData: "css-resolved",
          });
          if (resolved.errors.length) return { errors: resolved.errors };
          try {
            const file = await importPath(paths, args.path, resolved);
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
        const resolve = async (args: OnResolveArgs) => {
          if (
            ["repository-resolved", "css-resolved", "consumer-peer"].includes(
              args.pluginData,
            ) ||
            !["file", ""].includes(args.namespace)
          )
            return;
          // esbuild resolves this import itself; the bundle classifies the
          // module after the compile and can plan a second compile.
          if (resolution.mode === "native" && nativeResolution(paths, args))
            return;
          if (args.pluginData === undefined)
            handledImports?.add(
              importCallbackKey(args.importer, args.path, args.kind),
            );
          const planned =
            resolution.mode === "planned" && args.pluginData === undefined
              ? resolution.plan.get(args.importer, args.path, args.kind)
              : undefined;
          if (planned && resolution.mode === "planned")
            return await plannedResult(
              paths,
              args,
              resolution.plan.plan,
              planned,
            );
          const resolved = await resolveImport(paths, build, args.path, {
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
            const file = await importPath(paths, args.path, resolved);
            await paths.dependencyUsage.resolved(
              args.path,
              args.resolveDir,
              file,
            );
            const { workspaceSource: _workspaceSource, ...result } = resolved;
            return { ...result, path: file };
          } catch (error) {
            return { errors: [{ text: detail(error) }] };
          }
        };
        for (const filter of resolveFilters)
          build.onResolve({ filter }, resolve);
        build.onLoad({ filter: /.*/, namespace: "mokly-css" }, async (args) => {
          const file = paths.name(args.path);
          let contents = reads.get(args.path);
          if (contents === undefined) {
            contents = await fs.readFile(args.path);
            reads.set(args.path, contents);
          }
          inputs.files.set(args.path, contents);
          const module = args.path.endsWith(".module.css");
          const loaders = params.moduleResolution.loaders;
          const empty =
            loaders[".css"] === "empty" ||
            (module && loaders[".module.css"] === "empty");
          if (empty || !module)
            return { contents: "export default {};", loader: "js" };
          inputs.cssModules.add(file);
          return {
            contents: cssModuleSource(file),
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
