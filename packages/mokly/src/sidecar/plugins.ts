import fs from "node:fs/promises";
import path from "node:path";

import type { Loader, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { inside, logical } from "./paths.js";
import type { ConsumerRequire } from "./paths.js";
import { sideModule } from "./resolution.js";

export interface BundleInputs {
  files: Map<string, Uint8Array>;
  cssModules: Set<string>;
  stylePackages: Set<string>;
}

export function consumerPlugins(
  params: BundleParams,
  inputs: BundleInputs,
  require: ConsumerRequire,
  maps?: Record<string, Record<string, string>>,
  runtimeKey = "mokly:runtime",
): Plugin[] {
  const root = params.sourceRoot;
  const ownPackage = path.resolve(import.meta.dirname, "../..");
  return [
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
            sourceLoaders[extension];
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
            inside(root, importer) &&
            !logical(root, importer).split("/").includes("node_modules") &&
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
          if (!["mokly-authoring", "mokly-css"].includes(args.namespace))
            return {
              errors: [{ text: "Mokly's generation runtime is reserved" }],
            };
          return { path: runtimeKey, external: true };
        });
        build.onResolve({ filter: /^react\/jsx-dev-runtime$/ }, () => ({
          path: "jsx",
          namespace: "mokly-jsx",
        }));
        build.onLoad({ filter: /.*/, namespace: "mokly-jsx" }, () => ({
          contents: `import { jsx, jsxs, Fragment } from "react/jsx-runtime";
        export { Fragment };
        export function jsxDEV(type, props, key, staticChildren, source) {
          if (type && type[Symbol.for("mokly.component")] && source)
            props = {...props, __moklySource: source};
          return (staticChildren ? jsxs : jsx)(type, props, key);
        }`,
          resolveDir: root,
          loader: "js",
        }));
        build.onResolve(
          { filter: /^(react|react-dom)(\/.*)?$/ },
          async (args) => ({
            path: await require.resolvePeer(args.path),
            external: true,
          }),
        );
        build.onResolve(
          {
            filter:
              /^(styled-components|react-native-web|@emotion\/(react|cache|styled))(\/.*)?$/,
          },
          (args) => {
            inputs.stylePackages.add(args.path);
            return undefined;
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
          const real = await sideModule(
            resolved.path,
            root,
            params.repositoryRoots,
          );
          if (!inside(root, real))
            throw new Error(
              `CSS import is outside repoRoot in ${logical(root, args.importer)}: ${args.path}; move the stylesheet inside repoRoot or remove the import`,
            );
          return { path: real, namespace: "mokly-css" };
        });
        build.onResolve({ filter: /.*/ }, async (args) => {
          if (
            ["repository-resolved", "css-resolved"].includes(args.pluginData) ||
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
          return {
            ...resolved,
            path: await sideModule(resolved.path, root, params.repositoryRoots),
          };
        });
        build.onLoad({ filter: /.*/, namespace: "mokly-css" }, async (args) => {
          const file = logical(root, args.path);
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
          if (maps) {
            const names = Object.keys(maps[file] ?? {})
              .filter(
                (name) =>
                  /^[$_\p{ID_Start}](?:[$_\p{ID_Continue}]|\u200c|\u200d)*$/u.test(
                    name,
                  ) && !reserved.has(name),
              )
              .sort();
            return {
              contents: `const map = require("mokly:runtime").css(${JSON.stringify(file)}); export default map;\n${names.map((name, index) => `const __class_${index} = map[${JSON.stringify(name)}]; export { __class_${index} as ${name} };`).join("\n")}`,
              loader: "js",
            };
          }
          return {
            contents: `module.exports = require("mokly:runtime").css(${JSON.stringify(file)});`,
            loader: "js",
          };
        });
      },
    },
  ];
}

const reserved = new Set(
  "await break case catch class const continue debugger default delete do else enum export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(
    " ",
  ),
);

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
