import path from "node:path";

import type { Plugin } from "vite";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { cssModulePrefix } from "./css-modules.js";
import type { ModulePaths } from "./module-paths.js";
import {
  authoringModulePath,
  authoringModuleSource,
  cssModuleSource,
  jsxDevelopmentModuleSource,
  runtimeImportAllowed,
} from "./virtual-modules.js";
import {
  viteCssEnabled,
  viteCssModule,
  viteStylesheet,
} from "./vite-css-paths.js";
import type { ViteCssTransform } from "./vite-css-transform.js";
import { viteExternal } from "./vite-external.js";
import { recordViteInput } from "./vite-inputs.js";
import type { VitePluginReports } from "./vite-plugin-inputs.js";
import { viteReactImport } from "./vite-react-peers.js";
import type { VitePeers } from "./vite-react-peers.js";
import type { ViteLookup } from "./vite-resolution.js";
import type { ViteStyles } from "./vite-styles.js";
import { viteCss, viteEntry, viteFile, viteId, viteJsx } from "./vite-urls.js";

export interface ViteInputs {
  params: BundleParams;
  paths: ModulePaths;
  runtimeKey: string;
  entry: string;
  files: Map<string, Uint8Array>;
  pluginInputs: Map<string, string | null>;
  diagnostic: (line: string) => void;
  cssModules: Set<string>;
  styles: ViteStyles;
  lookup: ViteLookup;
  peers: VitePeers;
  external: (
    source: string,
    importer: string | undefined,
  ) => Promise<string | undefined>;
}

export function moklyViteFirstPlugin(
  current: () => ViteInputs,
  reports: VitePluginReports,
  css: ViteCssTransform,
): Plugin {
  return {
    name: "mokly-first",
    enforce: "pre",
    ...reports.hooks(current),
    resolveId: {
      order: "pre",
      async handler(source, importer) {
        const input = current();
        source = viteId(source);
        const inline = css.forId(source);
        if (inline) return inline.id;
        if (source === viteEntry || source === viteJsx) return source;
        if (importer === viteEntry) {
          const file = viteFile(source);
          if (file && input.paths.configuredFile(file))
            return input.paths.resolve(file);
        }
        if (
          source.startsWith("mokly:runtime") ||
          source.startsWith(cssModulePrefix)
        ) {
          const namespace = importer?.startsWith("\0mokly-authoring:")
            ? "mokly-authoring"
            : importer?.startsWith("\0mokly-style:")
              ? "mokly-style"
              : importer && viteStylesheet(viteFile(importer) ?? "")
                ? "mokly-css"
                : "";
          if (!runtimeImportAllowed(source, namespace))
            throw new Error("Mokly's generation runtime is reserved");
          return {
            id:
              source === "mokly:runtime"
                ? input.runtimeKey
                : input.runtimeKey + source,
            external: true,
          };
        }
        return (
          input.styles.original(source, importer) ??
          (await resolveViteLibrary(input, source, importer)) ??
          resolveViteModule(input, source, importer)
        );
      },
    },
  };
}

/** Resolve protected library imports at both Vite's hook and the runner boundary. */
export async function resolveViteLibrary(
  input: ViteInputs,
  source: string,
  importer?: string,
): Promise<string | undefined> {
  if (source === "@mokly/mokly")
    return (
      "\0mokly-authoring:" +
      (await authoringModulePath(
        input.paths.sourceRoot,
        viteFile(importer ?? "") ?? "",
        input.paths,
      ))
    );
  const react = viteReactImport(source, input.peers);
  if (react) return react;
  return input.styles.resolve(source, importer, input.lookup, input.external);
}

async function resolveViteModule(
  { params, paths, lookup, external: native }: ViteInputs,
  source: string,
  importer: string | undefined,
) {
  const resolution = await lookup.resolve(source, importer);
  if (!resolution) return null;
  const { resolved } = resolution;
  const confined = viteFile(resolved.id);
  if (!confined) return resolved;
  await paths.dependencyUsage.resolved(
    resolution.source,
    importer
      ? path.dirname(importer)
      : path.resolve(params.sourceRoot, params.configurationDirectory),
    confined,
  );
  if (viteStylesheet(confined))
    return { ...resolved, external: false, id: viteCss(confined) };
  const external =
    !paths.repositoryOwned(confined) &&
    (await native(resolution.source, importer));
  return {
    ...resolved,
    external: false,
    id: external
      ? viteExternal(await paths.resolve(external))
      : resolved.external && !paths.repositoryOwned(confined)
        ? viteExternal(confined)
        : resolved.id,
  };
}

/** Provide Mokly's virtual source modules and record consumed files. */
export function moklyVitePlugin(
  current: () => ViteInputs,
  css: ViteCssTransform,
): Plugin {
  return {
    name: "mokly",
    enforce: "pre",
    async load(id) {
      const input = current();
      const inline = css.forId(id);
      const { params, paths } = input;
      if (id === viteEntry) return input.entry;
      if (id === viteJsx)
        return jsxDevelopmentModuleSource(
          paths.sourceRoot,
          params.configurationDirectory,
        );
      if (id.startsWith("\0mokly-authoring:"))
        return (
          `import runtime from "mokly:runtime";\n` +
          authoringModuleSource(
            id.slice("\0mokly-authoring:".length),
            "runtime",
          )
        );
      const style = input.styles.source(id);
      if (style) return style;
      const file = viteFile(id);
      if (!file) return;
      const confined = await paths.resolve(file);
      await recordViteInput(input, confined);
      if (inline || !viteStylesheet(confined)) return;
      if (
        !viteCssModule(confined) ||
        !viteCssEnabled(params.moduleResolution.loaders, confined)
      )
        return "export default {};";
      const name = paths.name(confined);
      input.cssModules.add(name);
      return (
        `import runtime from "mokly:runtime";\n` +
        cssModuleSource(name, "runtime")
      );
    },
  };
}
