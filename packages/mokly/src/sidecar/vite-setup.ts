import { createHash } from "node:crypto";
import path from "node:path";

import type { InlineConfig, Plugin, UserConfig } from "vite";

import type { ViteSetupInputs } from "../generated/sidecar/ViteSetupInputs.js";

import type { ModulePaths } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { directoryFiles } from "./resolution-inputs.js";
import { loadViteConfig, viteConfigFiles } from "./vite-config.js";
import { configureViteCss, hookViteCss } from "./vite-css-hooks.js";
import type { ViteCssTransform } from "./vite-css-transform.js";
import type { loadVite } from "./vite-peers.js";
import { VitePostcssLookup } from "./vite-postcss-lookup.js";
import { vitePeerPlugin } from "./vite-react-peers.js";
import type { VitePeers } from "./vite-react-peers.js";
import type { ViteLookup } from "./vite-resolution.js";
import { setupCandidate } from "./vite-setup-input.js";
import type { SetupInput } from "./vite-setup-input.js";
import {
  envFiles,
  ViteWorkingEnv,
  workingEnvPrefix,
} from "./vite-working-env.js";

interface SetupFiles {
  configuration: string[];
  env: string[];
  rebuild: string[];
  postcss: VitePostcssLookup;
  workingEnv: ViteWorkingEnv | undefined;
}

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
  const workingEnv =
    inputs?.baseEnv &&
    new ViteWorkingEnv(inputs.baseEnv, paths.sourceRoot, mode);
  const open = () =>
    loadSetup(
      vite,
      directory,
      plugin,
      lookup,
      peers,
      css,
      postcss,
      workingEnv,
      rebuild,
    );
  const setup = await (workingEnv ? workingEnv.run(open) : open());
  try {
    const state = await setupSnapshot(setup.files, directory, paths);
    if (
      !matches(watched, state.inputs) ||
      !matches(await postcss.initial, state.inputs) ||
      (workingEnv && !workingEnv.matches(state.inputs))
    )
      throw new Error("Vite setup changed during compilation");
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
  workingEnv: ViteWorkingEnv | undefined,
  rebuild: string[],
) {
  const loaded = await loadViteConfig(vite, directory, lookup);
  const config = loaded?.config ?? {};
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
  const configuration = [
    ...viteConfigFiles.map((file) => path.join(directory, file)),
    ...(loaded?.dependencies ?? []),
  ];
  const env = envFiles(server.config.mode, server.config.envDir).filter(
    (file) => !workingEnv?.replaces(file),
  );
  const files: SetupFiles = {
    configuration,
    env,
    rebuild,
    postcss,
    workingEnv,
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

/** Snapshot setup bytes and config lookup membership before reusing a server. */
export async function setupSnapshot(
  files: SetupFiles,
  directory: string,
  paths: ModulePaths,
) {
  const configuration = await confinedInputs(files.configuration, paths);
  const env = await Promise.all(
    files.env.map(async (file) => {
      if (!files.workingEnv && inside(paths.sourceRoot, file)) {
        const name = workingEnvPrefix + logical(paths.sourceRoot, file);
        return setupCandidate(name, file);
      }
      const physical = await paths.metadata(file);
      return setupCandidate(paths.metadataName(physical), physical);
    }),
  );
  const required = [
    ...env,
    ...(await files.postcss.snapshot()),
    ...((await files.workingEnv?.snapshot()) ?? []),
  ];
  return setupEvidence(
    configuration,
    required,
    await rebuildInputs(files.rebuild, paths),
    await directoryFiles(directory),
  );
}

function setupEvidence(
  configuration: SetupInput[],
  required: SetupInput[],
  rebuild: SetupInput[],
  entries: string[],
) {
  const inputs = [...configuration, ...required, ...rebuild];
  const stamp = JSON.stringify([inputs, entries]);
  const digest = createHash("sha256")
    .update(JSON.stringify(inputs.map(({ name, digest }) => [name, digest])))
    .digest("hex");
  return { stamp, inputs, configuration, required, rebuild, entries, digest };
}

export type SetupSnapshot = ReturnType<typeof setupEvidence>;
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
    state.required,
    state.rebuild.filter(({ name }) => !sources.has(name)),
    state.entries,
  );
}

function rebuildInputs(files: string[], paths: ModulePaths) {
  return Promise.all(
    files.map(async (name) =>
      setupCandidate(
        name,
        await paths.metadata(path.resolve(paths.sourceRoot, name)),
      ),
    ),
  );
}

async function confinedInputs(files: string[], paths: ModulePaths) {
  return Promise.all(
    [...new Set(files)].map(async (file) => {
      const physical = await paths.metadata(file);
      return setupCandidate(paths.metadataName(physical), physical);
    }),
  );
}

function matches(
  previous: readonly SetupInput[],
  current: readonly SetupInput[],
): boolean {
  const now = new Map(current.map((input) => [input.name, input]));
  return previous.every(({ name, file, digest }) => {
    const input = now.get(name);
    return input?.file === file && input?.digest === digest;
  });
}
