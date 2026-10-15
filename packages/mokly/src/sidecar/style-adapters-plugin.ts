import { createHash } from "node:crypto";
import path from "node:path";

import type { Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { nodeImportMode } from "./import-mode.js";

interface Wrapper {
  file: string;
  registry: string;
  adapter: string;
  commonjs: boolean;
}

/** Capture the bundled registry while its consumer import evaluates. */
export function styleAdaptersPlugin(
  params: BundleParams,
  origins: Map<string, string>,
): Plugin {
  const aliases = Object.entries(params.moduleResolution.aliases).sort(
    ([left], [right]) => right.length - left.length,
  );
  const wrappers = new Map<string, Wrapper>();
  const packageModes = new Map<string, Promise<boolean>>();
  return {
    name: "mokly-style-adapters",
    setup(builder) {
      builder.onResolve({ filter: /^mokly:style-source:/ }, (args) => {
        if (args.namespace !== "mokly-style")
          return {
            errors: [{ text: "Mokly's style adapter source is reserved" }],
          };
        return { path: args.path.slice("mokly:style-source:".length) };
      });
      builder.onResolve({ filter: /.*/ }, async (args) => {
        if (
          [
            "style-original",
            "repository-resolved",
            "css-resolved",
            "consumer-peer",
          ].includes(args.pluginData)
        )
          return;
        const alias = aliases.find(
          ([name]) => args.path === name || args.path.startsWith(`${name}/`),
        );
        const requested = alias
          ? alias[1] + args.path.slice(alias[0].length)
          : args.path;
        const library =
          /^(styled-components|react-native-web|@emotion\/react)(?:\/|$)/.exec(
            requested,
          )?.[1];
        if (!library) return;
        const resolved = await builder.resolve(args.path, {
          resolveDir: args.resolveDir,
          importer: args.importer,
          kind: args.kind,
          pluginData: "style-original",
        });
        if (resolved.errors.length || resolved.external) return resolved;
        const registry =
          requested === library
            ? resolved
            : await builder.resolve(library, {
                resolveDir: path.dirname(resolved.path),
                importer: resolved.path,
                kind: args.kind,
                pluginData: "style-original",
              });
        if (registry.errors.length) return registry;
        const commonjs =
          args.kind === "require-call" || args.kind === "require-resolve";
        const node =
          !commonjs && (await nodeImportMode(args.importer, packageModes));
        const key =
          createHash("sha256")
            .update(
              JSON.stringify([
                resolved.path,
                registry.path,
                args.importer,
                args.kind,
              ]),
            )
            .digest("hex") + (node ? ".mjs" : ".cjs");
        wrappers.set(key, {
          file: resolved.path,
          registry: registry.path,
          commonjs,
          adapter:
            library === "styled-components"
              ? "styled"
              : library === "react-native-web"
                ? "native"
                : "emotion",
        });
        origins.set(`mokly-style:${key}`, args.importer);
        return {
          path: key,
          namespace: "mokly-style",
        };
      });
      builder.onLoad({ filter: /.*/, namespace: "mokly-style" }, (args) => {
        const { file, registry, adapter, commonjs } = wrappers.get(args.path)!;
        const original = JSON.stringify(`mokly:style-source:${file}`);
        const capture = JSON.stringify(`mokly:style-source:${registry}`);
        return {
          contents: [
            commonjs
              ? `const original = require(${original}); module.exports = original;`
              : `import * as original from ${original}; export * from ${original}; export default original.default;`,
            ...(file === registry
              ? []
              : [
                  commonjs
                    ? `const registry = require(${capture});`
                    : `import * as registry from ${capture};`,
                ]),
            `require("mokly:runtime").style(${JSON.stringify(adapter)}, ${file === registry ? "original" : "registry"});`,
          ].join("\n"),
          resolveDir: path.dirname(file),
          loader: "js",
        };
      });
    },
  };
}
