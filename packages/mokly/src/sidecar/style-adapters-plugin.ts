import type { Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

/** Capture the bundled registry while its consumer import evaluates. */
export function styleAdaptersPlugin(params: BundleParams): Plugin {
  const aliases = Object.entries(params.moduleResolution.aliases).sort(
    ([left], [right]) => right.length - left.length,
  );
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
        return {
          path: JSON.stringify([resolved.path, library, requested === library]),
          namespace: "mokly-style",
        };
      });
      builder.onLoad({ filter: /.*/, namespace: "mokly-style" }, (args) => {
        const [file, library, root] = JSON.parse(args.path) as [
          string,
          string,
          boolean,
        ];
        const original = JSON.stringify(`mokly:style-source:${file}`);
        const adapter =
          library === "styled-components"
            ? "styled"
            : library === "react-native-web"
              ? "native"
              : "emotion";
        return {
          contents: [
            `import * as original from ${original};`,
            `export * from ${original}; export default original.default;`,
            ...(root
              ? []
              : [`import * as registry from ${JSON.stringify(library)};`]),
            `require("mokly:runtime").style(${JSON.stringify(adapter)}, ${root ? "original" : "registry"});`,
          ].join("\n"),
          resolveDir: params.sourceRoot,
          loader: "js",
        };
      });
    },
  };
}
