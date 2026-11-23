import path from "node:path";

import type { InlineConfig, Plugin, UserConfig } from "vite";

import { fileDigest } from "./file-digests.js";
import { directoryFiles } from "./resolution-inputs.js";
import { loadViteConfig, viteConfigFiles } from "./vite-config.js";
import { configureViteCss, hookViteCss } from "./vite-css-hooks.js";
import type { ViteCssTransform } from "./vite-css-transform.js";
import type { loadVite } from "./vite-peers.js";
import { vitePeerPlugin } from "./vite-react-peers.js";
import type { VitePeers } from "./vite-react-peers.js";
import type { ViteLookup } from "./vite-resolution.js";

/** Load the app setup without writing a config bundle or starting a watcher. */
export async function viteSetup(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  plugin: Plugin,
  lookup: ViteLookup,
  peers: () => VitePeers,
  css: ViteCssTransform,
) {
  const loaded = await loadViteConfig(vite, directory, lookup);
  const config = loaded?.config ?? {};
  const inline: InlineConfig = {
    ...config,
    configFile: false,
    root: config.root ? path.resolve(directory, config.root) : directory,
    mode: "development",
    logLevel: "silent",
    appType: "custom",
    server: {
      ...config.server,
      middlewareMode: true,
      watch: null,
      hmr: false,
      ws: false,
    },
    plugins: [
      plugin,
      ...(config.plugins ?? []),
      noOptimizer(),
      vitePeerPlugin(lookup, peers),
      css.capture(),
    ],
  };
  const resolved = await vite.resolveConfig(
    inline,
    "serve",
    "development",
    "development",
    false,
    (config) => configureViteCss(config, lookup, css),
    (plugins) => hookViteCss(plugins, css),
  );
  const server = await vite.createServer(resolved);
  lookup.bind(vite, server.environments.ssr!);
  const envDirectory = server.config.envDir;
  const files = [
    ...viteConfigFiles.map((file) => path.join(directory, file)),
    ...(loaded?.dependencies ?? []),
    ...(envDirectory === false
      ? []
      : [
          ".env",
          ".env.local",
          ".env.development",
          ".env.development.local",
        ].map((file) => path.join(envDirectory, file))),
  ];
  return { server, files: [...new Set(files)] };
}

/** Config and environment hooks run after app plugins can add optimizer entries. */
function noOptimizer(): Plugin {
  const clear = (config: Pick<UserConfig, "optimizeDeps">) => {
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [],
      entries: [],
      noDiscovery: true,
    };
  };
  return {
    name: "mokly-no-optimizer",
    enforce: "post",
    config(config) {
      clear(config);
      config.server = {
        ...config.server,
        middlewareMode: true,
        watch: null,
        hmr: false,
        ws: false,
      };
      config.appType = "custom";
    },
    configEnvironment(_name, config) {
      clear(config);
    },
  };
}

/** Config imports, env bytes, and config lookup membership decide server reuse. */
export async function setupStamp(
  files: string[],
  directory: string,
): Promise<string> {
  return JSON.stringify([
    await Promise.all(
      files.map(async (file) => [file, await fileDigest(file)]),
    ),
    await directoryFiles(directory),
  ]);
}
