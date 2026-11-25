import { createHash } from "node:crypto";
import path from "node:path";

import type { build } from "esbuild";

import type { BundleCapture } from "../generated/sidecar/BundleCapture.js";
import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { CompiledGeneration } from "../generated/sidecar/CompiledGeneration.js";
import type { TransformViteCssParams } from "../generated/sidecar/TransformViteCssParams.js";
import type { ViteCssResult } from "../generated/sidecar/ViteCssResult.js";

import { entryModule } from "./bundle-entry.js";
import type { Bundled } from "./bundle.js";
import { bundleResult, restore } from "./compiled.js";
import { withViteConfigResolution } from "./vite-config-resolution.js";
import { ViteContext, viteModulePaths } from "./vite-context.js";
import {
  FreshViteWorker,
  viteFailure,
  viteStylesheetFailure,
} from "./vite-errors.js";
import { createViteFetch } from "./vite-fetch.js";
import { viteGraph, walkVite } from "./vite-graph.js";
import { verifyViteInputs } from "./vite-inputs.js";
import { snapshotViteInputs } from "./vite-invalidation.js";
import { viteMetadata } from "./vite-metadata.js";
import { loadVite, withVitePeers } from "./vite-peers.js";
import { verifySetup } from "./vite-setup-snapshot.js";
import { excludeRebuildFiles } from "./vite-setup.js";
import { viteToolchain } from "./vite-toolchain.js";
import { viteEntry, viteUrl } from "./vite-urls.js";

/** One app server belongs to this process and root; recipes outlive that server. */
export class ViteCompiler {
  private readonly context: ViteContext;

  /** `diagnostic` sends one sidecar diagnostic event, such as a skipped plugin report. */
  constructor(diagnostic: (line: string) => void) {
    this.context = new ViteContext(diagnostic);
  }

  async bundle(
    params: BundleParams,
    compile: typeof build,
    capture: BundleCapture,
  ): Promise<Bundled> {
    const paths = await viteModulePaths(params);
    params = { ...params, sourceRoot: paths.sourceRoot };
    let version: string | undefined;
    try {
      return await withVitePeers(params, compile, async (require) => {
        const vite = await loadVite(require);
        version = vite.api.version;
        const entry = await entryModule(params, undefined, capture);
        if (entry.preview) paths.addConfigured(entry.preview);
        const { setup, input, directory } = await this.context.open(
          vite.api,
          require,
          params,
          paths,
          entry.contents,
        );
        const imports = new Map<string, string[]>();
        const fetch = createViteFetch(
          setup.server,
          input,
          imports,
          version,
          setup.pluginReports,
          setup.snapshot?.files,
        );
        const { recipe, children } = await withViteConfigResolution(
          input.lookup,
          () => walkVite(viteUrl(viteEntry), fetch, imports, vite.api.version),
        );
        const { modules, physical } = viteGraph(
          recipe,
          children,
          paths,
          input.files,
        );
        await verifyViteInputs(input);
        await verifySetup(setup, directory, paths);
        excludeRebuildFiles(setup, new Set(physical.keys()));
        const graphFiles = new Set(physical.values());
        const metadata = await viteMetadata(input, setup.state, graphFiles);
        setup.snapshot = await snapshotViteInputs(input, metadata, setup.state);
        const toolchain = await viteToolchain(version, vite.root);
        const compiled: CompiledGeneration = {
          code: "",
          vite: {
            ...recipe,
            setupDigest: setup.state.digest,
            envInputs: setup.state.envInputs,
          },
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
          peers: { ...require.snapshot(), ...input.peers },
          unmappedDependencyDirectories: [
            ...paths.dependencyUsage.unmapped,
          ].sort(),
          ...metadata,
        };
        const generation = restore(params, compiled, modules);
        return { generation, result: bundleResult(generation) };
      });
    } catch (error) {
      if (error instanceof FreshViteWorker) throw error;
      await this.dispose();
      throw viteFailure(
        error,
        paths,
        path.resolve(paths.sourceRoot, params.configurationDirectory),
        version,
      );
    }
  }

  async stylesheet(
    request: TransformViteCssParams,
    compile: typeof build,
  ): Promise<ViteCssResult> {
    const paths = await viteModulePaths(request.setup);
    const params = { ...request.setup, sourceRoot: paths.sourceRoot };
    try {
      return await withVitePeers(params, compile, async (require) => {
        const vite = await loadVite(require);
        if (!vite.api.isCSSRequest(request.stylesheet))
          throw new Error("Vite reads only a lowercase stylesheet suffix");
        const { setup, input, directory } = await this.context.open(
          vite.api,
          require,
          params,
          paths,
        );
        const { result, snapshot } = await withViteConfigResolution(
          input.lookup,
          () =>
            this.context.css.run(
              setup,
              input,
              request.stylesheet,
              request.file,
            ),
        );
        await verifySetup(setup, directory, paths);
        setup.stylesheets.set(request.file, snapshot);
        return result;
      });
    } catch (error) {
      if (error instanceof FreshViteWorker) throw error;
      await this.dispose();
      throw viteStylesheetFailure(error, paths, request.stylesheet);
    }
  }

  async dispose(): Promise<void> {
    await this.context.dispose();
  }
}
