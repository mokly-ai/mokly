import { randomBytes } from "node:crypto";
import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { fileDigest } from "./file-digests.js";
import { ModulePaths } from "./module-paths.js";
import type { ConsumerRequire } from "./paths.js";
import { ViteCssTransform } from "./vite-css-transform.js";
import { viteExternalResolver } from "./vite-external.js";
import {
  changedViteInputs,
  invalidateViteModules,
} from "./vite-invalidation.js";
import type { ViteSnapshot } from "./vite-invalidation.js";
import type { loadVite } from "./vite-peers.js";
import { moklyVitePlugin } from "./vite-plugin.js";
import type { ViteInputs } from "./vite-plugin.js";
import { captureReactPeers } from "./vite-react-peers.js";
import { ViteLookup } from "./vite-resolution.js";
import { setupStamp, viteSetup } from "./vite-setup.js";
import { ViteStyles } from "./vite-styles.js";

interface Setup {
  server: Awaited<ReturnType<typeof viteSetup>>["server"];
  files: string[];
  key: string;
  stamp: string;
  snapshot?: ViteSnapshot;
  styles: ViteStyles;
  lookup: ViteLookup;
  stylesheetReports: Map<string, ReadonlyMap<string, string | null>>;
}

export function viteModulePaths(params: BundleParams): Promise<ModulePaths> {
  return ModulePaths.create({
    ...params,
    moduleResolution: {
      ...params.moduleResolution,
      aliases: {},
      resolveExtensions: [],
    },
  });
}

/** Keep one side's setup alive between JavaScript and stylesheet requests. */
export class ViteContext {
  readonly css = new ViteCssTransform();
  private setup: Setup | undefined;
  private input: ViteInputs | undefined;

  constructor(private readonly diagnostic: (line: string) => void) {}

  async open(
    vite: Awaited<ReturnType<typeof loadVite>>["api"],
    require: ConsumerRequire,
    params: BundleParams,
    paths: ModulePaths,
    entry?: string,
  ) {
    const directory = path.resolve(
      paths.sourceRoot,
      params.configurationDirectory,
    );
    const input: ViteInputs = {
      params,
      paths,
      runtimeKey: `mokly:runtime:${randomBytes(24).toString("hex")}`,
      entry: entry ?? "",
      files: new Map(),
      pluginInputs: new Set(),
      diagnostic: this.diagnostic,
      cssModules: new Set(),
      styles: new ViteStyles(),
      external: async () => undefined,
      lookup: new ViteLookup(paths, directory),
      peers: {},
    };
    this.input = input;
    const key = JSON.stringify([
      paths.sourceRoot,
      directory,
      paths.dependencyRoots,
      paths.dependencyRoot,
      paths.repositoryRoots,
      Object.entries(require.snapshot()).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ]);
    const changed = await changedViteInputs(this.setup?.snapshot);
    if (
      this.setup &&
      (this.setup.key !== key ||
        changed.metadata ||
        this.setup.stamp !== (await setupStamp(this.setup.files, directory)) ||
        (await changedStylesheets(this.setup.stylesheetReports)))
    )
      await this.dispose();
    if (!this.setup) {
      const setup = await viteSetup(
        vite,
        directory,
        moklyVitePlugin(() => this.input!, this.css),
        input.lookup,
        () => this.input!.peers,
        this.css,
      );
      this.setup = {
        ...setup,
        key,
        stamp: await setupStamp(setup.files, directory),
        styles: input.styles,
        lookup: input.lookup,
        stylesheetReports: new Map(),
      };
    }
    const setup = this.setup;
    input.styles = setup.styles;
    input.lookup = setup.lookup;
    input.lookup.updatePaths(paths);
    input.lookup.bind(vite, setup.server.environments.ssr!);
    if (entry !== undefined) {
      input.external = viteExternalResolver(vite, setup.server, input.lookup);
      input.peers = await captureReactPeers(input.lookup);
      invalidateViteModules(setup.server, setup.snapshot, changed);
      for (const [file, bytes] of setup.snapshot?.files ?? [])
        if (setup.snapshot?.metadata[file] !== undefined)
          input.files.set(file, bytes);
    }
    return { setup, input, directory };
  }

  async dispose(): Promise<void> {
    const setup = this.setup;
    this.setup = undefined;
    await setup?.server.close();
  }
}

async function changedStylesheets(
  reports: Setup["stylesheetReports"],
): Promise<boolean> {
  const files = new Map([...reports.values()].flatMap((report) => [...report]));
  for (const [file, digest] of files)
    if ((await fileDigest(file)) !== digest) return true;
  return false;
}
