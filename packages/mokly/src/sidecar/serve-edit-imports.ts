import path from "node:path";

import type { Metafile, Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";
import type { ReuseEvidence } from "../generated/sidecar/ReuseEvidence.js";

import { ConfigInputs } from "./config-inputs.js";
import type { ModulePaths } from "./module-paths.js";
import { absoluteSpecifierPattern, substitution } from "./path-pattern.js";
import { PhysicalInputs } from "./physical-inputs.js";
import { resolutionRequest } from "./resolution-request.js";
import { serveEditLookups } from "./serve-edit-lookups.js";

/** Classify authored absolute imports without capturing mapped candidates on Serve edits. */
export class ServeEditImports {
  reusable = true;
  readonly plugin: Plugin;

  constructor(
    private readonly params: BundleParams,
    paths: ModulePaths,
  ) {
    const aliases = Object.entries(paths.settings.aliases).sort(
      ([a], [b]) => b.length - a.length,
    );
    const directory = path.resolve(
      params.sourceRoot,
      params.configurationDirectory,
    );
    let physical: PhysicalInputs | undefined;
    let configs: ConfigInputs | undefined;
    this.plugin = {
      name: "mokly-serve-edit-imports",
      setup: (build) => {
        build.onResolve({ filter: absoluteSpecifierPattern }, (args) => {
          if (!this.reusable || args.namespace !== "file") return;
          const request = resolutionRequest(
            args.path,
            args.resolveDir,
            aliases,
            directory,
          );
          if (request.kind !== "lookup" || !path.isAbsolute(request.name))
            return;
          physical ??= new PhysicalInputs();
          configs ??= new ConfigInputs(physical, paths);
          const config = configs.scope(request.directory);
          this.reusable =
            physical.complete &&
            !Object.keys(config.paths?.targets ?? {}).some(
              (pattern) =>
                pattern.includes("${configDir}") ||
                substitution(pattern, request.name) !== undefined,
            );
        });
      },
    };
  }

  record(metafile: Metafile, paths: ModulePaths): ReuseEvidence | undefined {
    return this.reusable
      ? serveEditLookups(
          metafile,
          paths,
          path.resolve(
            this.params.sourceRoot,
            this.params.configurationDirectory,
          ),
        )
      : undefined;
  }
}
