import path from "node:path";

import type { InlineConfig, Plugin, UserConfig } from "vite";

import type { ViteSetupInputs } from "../generated/sidecar/ViteSetupInputs.js";

import { loadViteConfig } from "./vite-config.js";
import { configureViteCss, hookViteCss } from "./vite-css-hooks.js";
import type { ViteCssTransform } from "./vite-css-transform.js";
import type { loadVite } from "./vite-peers.js";
import { VitePostcssLookup } from "./vite-postcss-lookup.js";
import { vitePeerPlugin } from "./vite-react-peers.js";
import type { VitePeers } from "./vite-react-peers.js";
import type { ViteLookup } from "./vite-resolution.js";
import type { ConfigReads } from "./vite-setup-input.js";
import {
  rebuildInputs,
  setupEvidence,
  setupSnapshot,
  verifyConfigReads,
  verifyInputs,
} from "./vite-setup-snapshot.js";
import type { SetupFiles } from "./vite-setup-snapshot.js";
import { envFiles, ViteEnv } from "./vite-working-env.js";

const mode = "development";

/** Load the app setup without writing a config bundle or starting a watcher. */
export async function viteSetup(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  plugin: Plugin,
  lookup: ViteLookup,
  peers: () => VitePeers,
  css: ViteCssTransform,
  inputs: ViteSetupInputs | undefined,
  diagnostic: (line: string) => void,
) {
  const paths = lookup.paths;
  const rebuild = inputs?.rebuildFiles ?? [];
  const watched = await rebuildInputs(rebuild, paths);
  const postcss = new VitePostcssLookup(paths, diagnostic);
  const env = new ViteEnv(inputs?.baseEnv, paths, mode);
  const setup = await env.run(() =>
    loadSetup(
      vite,
      directory,
      plugin,
      lookup,
      peers,
      css,
      postcss,
      env,
      rebuild,
    ),
  );
  try {
    const state = await setupSnapshot(setup.files, directory, paths);
    verifyConfigReads(setup.files.configuration, state, paths);
    verifyInputs(watched, state.rebuild);
    verifyInputs(await postcss.initial, state.postcss);
    env.verify(state.env);
    return { ...setup, state, ownedRebuildFiles: new Set<string>() };
  } catch (error) {
    await setup.server.close();
    throw error;
  }
}

async function loadSetup(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  plugin: Plugin,
  lookup: ViteLookup,
  peers: () => VitePeers,
  css: ViteCssTransform,
  postcss: VitePostcssLookup,
  env: ViteEnv,
  rebuild: string[],
) {
  const configuration: ConfigReads = { files: [], probes: new Map() };
  const config =
    (await loadViteConfig(vite, directory, lookup, configuration)) ?? {};
  const inline: InlineConfig = {
    ...config,
    configFile: false,
    root: config.root ? path.resolve(directory, config.root) : directory,
    mode,
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
  const server = await postcss.run(async () => {
    const resolved = await vite.resolveConfig(
      inline,
      "serve",
      mode,
      "development",
      false,
      (config) => {
        postcss.configure(vite, config);
        configureViteCss(config, lookup, css);
      },
      (plugins) => hookViteCss(plugins, css),
    );
    return vite.createServer(resolved);
  });
  lookup.bind(vite, server.environments.ssr!);
  const files: SetupFiles = {
    configuration,
    envFiles: envFiles(server.config.mode, server.config.envDir),
    env,
    rebuild,
    postcss,
  };
  return { server, files };
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

export type ViteSetup = Awaited<ReturnType<typeof viteSetup>>;

/** Keep graph-owned files out of the additional setup inputs once found. */
export function excludeRebuildFiles(
  setup: ViteSetup,
  sources: ReadonlySet<string>,
): void {
  const { files, ownedRebuildFiles, state } = setup;
  const rebuild = files.rebuild.filter((name) => {
    if (!sources.has(name)) return true;
    ownedRebuildFiles.add(name);
    return false;
  });
  if (rebuild.length === files.rebuild.length) return;
  files.rebuild = rebuild;
  setup.state = setupEvidence(
    state.configuration,
    state.probes,
    state.env,
    state.postcss,
    state.rebuild.filter(({ name }) => !sources.has(name)),
    state.entries,
  );
}
