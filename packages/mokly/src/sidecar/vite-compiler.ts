import { createHash, randomBytes } from "node:crypto";
import path from "node:path";

import type { build } from "esbuild";

import type { BundleCapture } from "../generated/sidecar/BundleCapture.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";

import { entryModule } from "./bundle-entry.js";
import type { Bundled } from "./bundle.js";
import { bundleResult, restore } from "./compiled.js";
import { ModulePaths } from "./module-paths.js";
import { viteFailure } from "./vite-errors.js";
import { createViteFetch } from "./vite-fetch.js";
import { viteGraph, walkVite } from "./vite-graph.js";
import { verifyViteInputs } from "./vite-inputs.js";
import { viteMetadata } from "./vite-metadata.js";
import { loadVite, withVitePeers } from "./vite-peers.js";
import { moklyVitePlugin } from "./vite-plugin.js";
import type { ViteInputs } from "./vite-plugin.js";
import { setupStamp, viteSetup } from "./vite-setup.js";
import { ViteStyles } from "./vite-styles.js";
import { viteToolchain } from "./vite-toolchain.js";
import { viteEntry, viteUrl } from "./vite-urls.js";

interface Setup {
  server: Awaited<ReturnType<typeof viteSetup>>["server"];
  files: string[];
  key: string;
  stamp: string;
}

/** One app server belongs to this process and root; recipes outlive that server. */
export class ViteCompiler {
  private setup: Setup | undefined;
  private input: ViteInputs | undefined;

  async bundle(
    params: BundleParams,
    compile: typeof build,
    capture: BundleCapture,
  ): Promise<Bundled> {
    const paths = await ModulePaths.create(params);
    params = { ...params, sourceRoot: paths.sourceRoot };
    let version: string | undefined;
    try {
      return await withVitePeers(params, compile, async (require) => {
        const vite = await loadVite(require);
        version = vite.api.version;
        const entry = await entryModule(params, undefined, capture);
        const input: ViteInputs = {
          params,
          paths,
          require,
          runtimeKey: `mokly:runtime:${randomBytes(24).toString("hex")}`,
          entry: entry.contents,
          files: new Map(),
          cssModules: new Set(),
          styles: new ViteStyles(),
        };
        this.input = input;
        const directory = path.resolve(
          paths.sourceRoot,
          params.configurationDirectory,
        );
        const key = JSON.stringify([
          paths.sourceRoot,
          directory,
          paths.dependencyRoots,
          Object.entries(require.snapshot()).sort(([a], [b]) =>
            a < b ? -1 : a > b ? 1 : 0,
          ),
        ]);
        if (
          this.setup &&
          (this.setup.key !== key ||
            this.setup.stamp !==
              (await setupStamp(this.setup.files, directory)))
        )
          await this.dispose();
        if (!this.setup) {
          const setup = await viteSetup(
            vite.api,
            directory,
            moklyVitePlugin(() => this.input!),
          );
          this.setup = {
            ...setup,
            key,
            stamp: await setupStamp(setup.files, directory),
          };
        }
        const imports = new Map<string, string[]>();
        const fetch = createViteFetch(
          this.setup.server,
          input,
          imports,
          version,
        );
        const { recipe, children } = await walkVite(
          viteUrl(viteEntry),
          fetch,
          imports,
          version,
        );
        const { modules } = viteGraph(recipe, children, paths, input.files);
        await verifyViteInputs(input);
        if (
          this.setup.stamp !== (await setupStamp(this.setup.files, directory))
        )
          throw new Error("Vite setup changed during compilation");
        const metadata = await viteMetadata(input, this.setup.files);
        const toolchain = await viteToolchain(version, vite.root);
        const compiled: CompiledGeneration = {
          code: "",
          vite: recipe,
          identity: createHash("sha256")
            .update(
              JSON.stringify([
                params,
                modules,
                metadata.metadataInputs,
                toolchain,
                input.runtimeKey,
              ]),
            )
            .digest("hex"),
          runtimeKey: input.runtimeKey,
          toolchain: toolchain ?? "",
          reuseEvidence: {
            complete: false,
            durable: false,
            inputs: {},
            ...(toolchain && capture === "serveEdit"
              ? { uncaptured: "serveEdit" as const }
              : {}),
          },
          dependencyRoots: paths.dependencyRoots,
          cssModules: [...input.cssModules],
          sources: Object.fromEntries(
            [...entry.inputPaths].map(([name, file]) => [
              name,
              Buffer.from(input.files.get(file) ?? []).toString("utf8"),
            ]),
          ),
          peers: require.snapshot(),
          unmappedDependencyDirectories: [
            ...paths.dependencyUsage.unmapped,
          ].sort(),
          ...metadata,
        };
        const generation = restore(params, compiled, modules);
        return { generation, result: bundleResult(generation) };
      });
    } catch (error) {
      throw viteFailure(
        error,
        paths,
        params.entryFiles[0]
          ? path.join(paths.sourceRoot, params.entryFiles[0])
          : "",
        version,
      );
    }
  }

  async dispose(): Promise<void> {
    const setup = this.setup;
    this.setup = undefined;
    await setup?.server.close();
  }
}
