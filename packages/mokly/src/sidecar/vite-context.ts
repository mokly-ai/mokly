import { randomBytes } from "node:crypto";
import path from "node:path";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { ModulePaths } from "./module-paths.js";
import type { ConsumerRequire } from "./paths.js";
import { ViteCssTransform } from "./vite-css-transform.js";
import type { ViteStylesheetSnapshot } from "./vite-css-transform.js";
import { viteExternalResolver } from "./vite-external.js";
import {
  changedViteInputs,
  invalidateViteModules,
} from "./vite-invalidation.js";
import type { ViteSnapshot } from "./vite-invalidation.js";
import type { loadVite } from "./vite-peers.js";
import { currentViteReport } from "./vite-plugin-inputs.js";
import type { ViteInputs } from "./vite-plugin.js";
import { captureReactPeers } from "./vite-react-peers.js";
import { ViteLookup } from "./vite-resolution.js";
import { setupSnapshot } from "./vite-setup-snapshot.js";
import { viteSetup } from "./vite-setup.js";
import { ViteStyles } from "./vite-styles.js";

interface Setup extends Awaited<ReturnType<typeof viteSetup>> {
  key: string;
  snapshot?: ViteSnapshot;
  styles: ViteStyles;
  lookup: ViteLookup;
  stylesheets: Map<string, ViteStylesheetSnapshot>;
  observed: Map<string, string | null>;
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
      pluginInputs: new Map(),
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
      params.viteInputs?.baseEnv,
      Object.entries(require.snapshot()).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    ]);
    const previous = this.setup?.key === key ? this.setup : undefined;
    if (entry !== undefined) previous?.ownedRebuildFiles.clear();
    const requested = params.viteInputs?.rebuildFiles ?? [];
    const requestedNames = new Set(requested);
    const ownedRebuildFiles = previous?.ownedRebuildFiles ?? new Set<string>();
    for (const name of ownedRebuildFiles)
      if (!requestedNames.has(name)) ownedRebuildFiles.delete(name);
    const rebuild = requested.filter((name) => !ownedRebuildFiles.has(name));
    const changed = await changedViteInputs(
      previous?.snapshot,
      previous?.stylesheets.values() ?? [],
      previous?.observed ?? new Map(),
    );
    if (
      this.setup &&
      (!previous ||
        changed.metadata ||
        previous.state.stamp !==
          (
            await setupSnapshot(
              { ...previous.files, rebuild },
              directory,
              paths,
            )
          ).stamp ||
        (await changedStylesheets(previous.stylesheets)))
    )
      await this.dispose();
    if (!this.setup) {
      const setup = await viteSetup(
        vite,
        directory,
        () => this.input!,
        input.lookup,
        this.css,
        { ...params.viteInputs, rebuildFiles: rebuild },
        this.diagnostic,
      );
      this.setup = {
        ...setup,
        key,
        ownedRebuildFiles,
        styles: input.styles,
        lookup: input.lookup,
        stylesheets: new Map(),
        observed: new Map(),
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
    }
    if (setup === previous) {
      await setup.watchEvents.dispatch(setup.server, changed.events);
      for (const [file, digest] of changed.files)
        setup.observed.set(file, digest);
      if (entry !== undefined || changed.files.size || changed.directories.size)
        invalidateViteModules(setup.server, setup.snapshot, changed);
      for (const [directory, names] of changed.directories)
        setup.snapshot?.directories.set(directory, names);
    } else if (entry !== undefined) {
      invalidateViteModules(setup.server, undefined, changed);
    }
    if (entry !== undefined) {
      for (const [file, bytes] of setup.snapshot?.files ?? [])
        if (
          setup.snapshot?.metadata[file] !== undefined &&
          !setup.snapshot.reports.has(file)
        )
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
  sheets: Setup["stylesheets"],
): Promise<boolean> {
  const files = new Map(
    [...sheets.values()].flatMap(({ dependencies }) => [...dependencies]),
  );
  for (const [file, digest] of files)
    if (!(await currentViteReport(file, digest))) return true;
  return false;
}
