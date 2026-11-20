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
import { viteExternal } from "./vite-external.js";
import { recordViteInput } from "./vite-inputs.js";
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
  cssModules: Set<string>;
  styles: ViteStyles;
  lookup: ViteLookup;
  peers: VitePeers;
  external: (
    source: string,
    importer: string | undefined,
  ) => Promise<string | undefined>;
}

const stylesheet = /\.(?:css|scss|sass|less|styl|stylus|pcss|postcss|sss)$/;

/** Keep authoring, peers, styles, and source confinement ahead of app transforms. */
export function moklyVitePlugin(current: () => ViteInputs): Plugin {
  return {
    name: "mokly",
    enforce: "pre",
    async resolveId(source, importer) {
      const { params, paths, runtimeKey, styles, lookup, peers } = current();
      source = viteId(source);
      if (source === viteEntry || source === viteJsx) return source;
      if (source === "@mokly/mokly")
        return (
          "\0mokly-authoring:" +
          (await authoringModulePath(
            paths.sourceRoot,
            viteFile(importer ?? "") ?? "",
            paths,
          ))
        );
      if (
        source.startsWith("mokly:runtime") ||
        source.startsWith(cssModulePrefix)
      ) {
        const namespace = importer?.startsWith("\0mokly-authoring:")
          ? "mokly-authoring"
          : importer?.startsWith("\0mokly-style:")
            ? "mokly-style"
            : importer && stylesheet.test(viteFile(importer) ?? "")
              ? "mokly-css"
              : "";
        if (!runtimeImportAllowed(source, namespace))
          throw new Error("Mokly's generation runtime is reserved");
        return {
          id: source === "mokly:runtime" ? runtimeKey : runtimeKey + source,
          external: true,
        };
      }
      if (source === "react/jsx-dev-runtime") return viteJsx;
      if (/^(react|react-dom)(?:\/|$)/.test(source)) {
        const peer = peers[source];
        return typeof peer === "string" ? viteExternal(peer) : null;
      }
      const style = await styles.resolve(source, importer, (source, importer) =>
        lookup
          .resolve(source, importer)
          .then((result) => result?.resolved ?? null),
      );
      if (style) return style;
      const resolution = await lookup.resolve(source, importer);
      const resolved = resolution?.resolved;
      if (!resolved) return null;
      const file = viteFile(resolved.id);
      if (!file) return resolved;
      const confined = await paths.resolve(file);
      await paths.dependencyUsage.resolved(
        source,
        importer
          ? path.dirname(importer)
          : path.resolve(params.sourceRoot, params.configurationDirectory),
        confined,
      );
      const external =
        !paths.repositoryOwned(confined) &&
        (await current().external(source, importer));
      return {
        ...resolved,
        external: false,
        id: external
          ? viteExternal(await paths.resolve(external))
          : resolved.external && !paths.repositoryOwned(confined)
            ? viteExternal(confined)
            : stylesheet.test(confined)
              ? viteCss(confined)
              : confined + resolved.id.slice(file.length),
      };
    },
    async load(id) {
      const input = current();
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
      if (!stylesheet.test(confined)) return;
      const module = /\.module\.[^.]+$/.test(confined);
      const loaders = params.moduleResolution.loaders;
      if (
        loaders[".css"] === "empty" ||
        (module && loaders[".module.css"] === "empty") ||
        !module
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
