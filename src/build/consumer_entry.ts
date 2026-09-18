import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { Plugin, PluginBuild } from "esbuild";

import { isInside, toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

/** Virtual module name for the complete consumer-owned build graph. */
export const CONSUMER_ENTRY_PATH = "mokly:consumer-entry";

/** Load every registry entry, renderer, and document transformer. */
export function consumerEntryPlugin(
  config: ResolvedConfig,
  entries: readonly string[],
): Plugin {
  return {
    name: "mokly-consumer-entry",
    setup(pluginBuild: PluginBuild): void {
      pluginBuild.onResolve({ filter: /^mokly:consumer-entry$/ }, () => ({
        namespace: "mokly-entry",
        path: CONSUMER_ENTRY_PATH,
      }));
      pluginBuild.onLoad({ filter: /.*/, namespace: "mokly-entry" }, () => ({
        contents: virtualEntryContents(config, entries),
        loader: "ts",
        resolveDir: path.dirname(config.configPath),
      }));
    },
  };
}

/** Resolve consumer imports of the public package with source attribution. */
export function packageApiPlugin(config: ResolvedConfig): Plugin {
  const realEntries = fs.realpathSync(config.entriesDir);
  const indexPath = runtimeModule("../index.js", "../index.ts");
  const definitionsPath = runtimeModule(
    "../authoring/definitions.js",
    "../authoring/definitions.ts",
  );
  return {
    name: "mokly-package-api",
    setup(pluginBuild: PluginBuild): void {
      pluginBuild.onResolve({ filter: /^@mokly\/mokly$/ }, (args) => {
        if (!args.importer) return { path: indexPath };
        let realImporter: string;
        try {
          realImporter = fs.realpathSync(args.importer);
        } catch {
          return { path: indexPath };
        }
        if (!isInside(realEntries, realImporter)) return { path: indexPath };
        return {
          namespace: "mokly-attributed-api",
          path: toPosixPath(path.relative(config.repoRoot, args.importer)),
        };
      });
      pluginBuild.onLoad(
        { filter: /.*/, namespace: "mokly-attributed-api" },
        (args) => ({
          contents: attributedApiContents(
            args.path,
            indexPath,
            definitionsPath,
          ),
          loader: "js",
        }),
      );
      pluginBuild.onResolve(
        { filter: /.*/, namespace: "mokly-attributed-api" },
        (args) => ({ namespace: "file", path: args.path }),
      );
    },
  };
}

function virtualEntryContents(
  config: ResolvedConfig,
  entries: readonly string[],
): string {
  const imports = entries.map(
    (source, index) => `import * as entry${index} from ${quote(source)};`,
  );
  const transformerImport = config.compatibility.transformer
    ? `import compatibilityTransformer from ${quote(config.compatibility.transformer)};`
    : "";
  const rendererPath =
    config.renderer ??
    runtimeModule("../renderer/default.js", "../renderer/default.tsx");
  const entryValues = entries.map(
    (_source, index) =>
      `(entry${index}.mockups ?? entry${index}.default ?? [])`,
  );
  return [
    ...imports,
    transformerImport,
    `import renderer from ${quote(rendererPath)};`,
    `const flatten = (values) => values.flat(Infinity);`,
    `export const definitions = flatten([${entryValues.join(",")}]);`,
    ...(config.compatibility.transformer
      ? [`export { compatibilityTransformer };`]
      : []),
    `export { renderer };`,
    `export { renderWithComponents } from ${quote(runtimeModule("../components/render.js", "../components/render.tsx"))};`,
  ].join("\n");
}

function attributedApiContents(
  sourceRelativePath: string,
  indexPath: string,
  definitionsPath: string,
): string {
  return [
    `import * as api from ${quote(indexPath)};`,
    `import { __attributeDefinition as attribute } from ${quote(definitionsPath)};`,
    `const source = ${quote(sourceRelativePath)};`,
    `export const definePage = (input) => attribute(api.definePage(input), source);`,
    `export const page = (input) => attribute(api.page(input), source);`,
    `import { defineComponent as registerComponent } from ${quote(runtimeModule("../components/definition.js", "../components/definition.ts"))};`,
    `export const defineComponent = (input) => { const value = registerComponent(input); value.entry.definedIn = source; return value; };`,
    `export const defineScreen = (input) => attribute(api.defineScreen(input), source);`,
    `export const defineCollection = (input) => attribute(api.defineCollection(input), source);`,
    `export const defineUseCase = (input) => attribute(api.defineUseCase(input), source);`,
    `export const screen = (input) => attribute(api.screen(input), source);`,
    `export const collection = (input) => attribute(api.collection(input), source);`,
    `export const defineRoot = (input) => api.defineRoot(input).map((definition) => definition.definedIn ? definition : attribute(definition, source));`,
    `export const defineConfig = api.defineConfig;`,
    `export const MockLink = api.MockLink;`,
    `export const mockLink = api.mockLink;`,
    `export const ReviewIgnore = api.ReviewIgnore;`,
    `export const ReviewIgnoreScope = api.ReviewIgnoreScope;`,
    `export const reviewMaterialKey = api.reviewMaterialKey;`,
    `export const resolveInstance = api.resolveInstance;`,
  ].join("\n");
}

function quote(value: string): string {
  return JSON.stringify(value);
}

/** Resolve a Mokly-owned module in either the built or source runtime. */
export function runtimeModule(compiled: string, source: string): string {
  const compiledPath = fileURLToPath(new URL(compiled, import.meta.url));
  return fs.existsSync(compiledPath)
    ? compiledPath
    : fileURLToPath(new URL(source, import.meta.url));
}
