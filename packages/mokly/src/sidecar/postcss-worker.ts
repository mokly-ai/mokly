import { performance } from "node:perf_hooks";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { detail } from "./errors.js";
import { parentInput } from "./parent-input.js";
import { guardParentOutput } from "./parent-output.js";
import { PostcssError, pluginFailure } from "./postcss-errors.js";
import {
  beginReadEvidenceGeneration,
  initializeReadEvidenceGeneration,
  loadedModulePaths,
  observeModuleLoads,
  preloadedObserver,
  readEvidence,
} from "./postcss-evidence.js";
import { loadPostcss } from "./postcss-loader.js";
import { bundledPostcssSource } from "./postcss-module.js";
import { observeModulePaths } from "./postcss-path-hooks.js";
import { PostcssPhases } from "./postcss-phases.js";
import { observeFileReads } from "./postcss-read-files.js";
import {
  configureResolution,
  loadedFiles,
  nodeLoadedFiles,
} from "./postcss-resolution.js";

type WorkerData = Pick<
  ProcessCssParams,
  "context" | "sourceRoot" | "moduleResolution" | "repositoryRoots" | "postcss"
>;

guardParentOutput();
const parent = parentInput();
const phases = new PostcssPhases(
  { now: () => performance.now() },
  (line) =>
    process.env.MOKLY_POSTCSS_PHASES === "1" &&
    process.send?.({ event: "postcss-phase", line }),
);
parent.stream.on("error", () => process.exit(1));
process.on("disconnect", () => process.exit());
const spawned = phases.start("spawn");
process.once("message", (workerData: WorkerData) => {
  spawned("ok");
  initializeReadEvidenceGeneration(workerData.context);
  if (!preloadedObserver()) {
    observeFileReads();
    observeModulePaths();
  }
  observeModuleLoads((url) => phases.moduleUrl(url));
  const configuration = configureResolution(workerData).then((paths) =>
    loadPostcss(workerData.postcss, paths, phases).then((loaded) => ({
      ...loaded,
      paths,
    })),
  );
  configuration.catch(() => {});
  process.on(
    "message",
    async ({ id, params }: { id: number; params: ProcessCssParams }) => {
      try {
        beginReadEvidenceGeneration(params.context);
        const { processor, modules, paths } = await configuration;
        const result = await phases.run("stylesheet-run", () =>
          processor
            .process(params.text, {
              from: params.sourcePath,
              map: false,
            })
            .catch((error: unknown) => {
              throw pluginFailure(error, paths.name(params.sourcePath));
            }),
        );
        const nodeLoads = nodeLoadedFiles(
          paths.sourceRoot,
          loadedModulePaths(),
        );
        const moduleFiles = new Set([
          ...modules,
          ...paths.resolvedDependencies,
          ...loadedFiles(paths.sourceRoot),
          ...nodeLoads.keys(),
        ]);
        const dependencies: CssResult["dependencies"] = [...moduleFiles].map(
          (path) => {
            const node = nodeLoads.get(path);
            const source =
              bundledPostcssSource(path) ??
              (node === undefined
                ? undefined
                : node
                  ? "node-package-require"
                  : "node");
            return { kind: "file", path, ...(source ? { source } : {}) };
          },
        );
        for (const message of result.messages) {
          if (
            message.type !== "dependency" &&
            message.type !== "dir-dependency"
          )
            continue;
          const path =
            message.type === "dependency" ? message.file : message.dir;
          if (
            typeof path !== "string" ||
            !path ||
            (message.glob !== undefined && typeof message.glob !== "string")
          )
            throw new PostcssError({
              kind: "dependency",
              plugin:
                typeof message.plugin === "string" ? message.plugin : "unknown",
              stylesheet: paths.name(params.sourcePath),
            });
          dependencies.push({
            kind: message.type === "dependency" ? "file" : "directory",
            path,
            ...(message.type === "dependency" ? { source: "plugin" } : {}),
            ...(typeof message.plugin === "string"
              ? { plugin: message.plugin }
              : {}),
            ...(typeof message.glob === "string" ? { glob: message.glob } : {}),
          });
        }
        process.send?.({
          id,
          result: {
            text: result.css,
            readEvidence: readEvidence(moduleFiles),
            dependencies,
            unmappedDependencyDirectories: [
              ...paths.dependencyUsage.unmapped,
            ].sort(),
          },
        });
      } catch (error) {
        process.send?.({
          id,
          error: detail(error),
          ...(error instanceof PostcssError ? { postcss: error.failure } : {}),
        });
      }
    },
  );
});
