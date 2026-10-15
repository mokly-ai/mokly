import { parentPort, workerData } from "node:worker_threads";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { detail } from "./errors.js";
import { PostcssError } from "./postcss-errors.js";
import { loadPostcss } from "./postcss-loader.js";
import { configureResolution, loadedFiles } from "./postcss-resolution.js";

const configuration = configureResolution(workerData).then((paths) =>
  loadPostcss(workerData.postcss, paths).then((loaded) => ({
    ...loaded,
    paths,
  })),
);
configuration.catch(() => {});
parentPort?.on(
  "message",
  async ({ id, params }: { id: number; params: ProcessCssParams }) => {
    try {
      const { processor, modules, paths } = await configuration;
      const result = await processor
        .process(params.text, {
          from: params.sourcePath,
          map: false,
        })
        .catch((error: unknown) => {
          const plugin =
            error &&
            typeof error === "object" &&
            "plugin" in error &&
            typeof error.plugin === "string"
              ? error.plugin
              : "unknown";
          throw new PostcssError({
            kind: "plugin",
            plugin,
            stylesheet: paths.name(params.sourcePath),
            detail: detail(error),
          });
        });
      const dependencies: CssResult["dependencies"] = [
        ...new Set([
          ...modules,
          ...loadedFiles(workerData.sourceRoot as string),
        ]),
      ].map((path) => ({
        kind: "file",
        path,
      }));
      for (const message of result.messages) {
        if (message.type !== "dependency" && message.type !== "dir-dependency")
          continue;
        const path = message.type === "dependency" ? message.file : message.dir;
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
          ...(typeof message.plugin === "string"
            ? { plugin: message.plugin }
            : {}),
          ...(typeof message.glob === "string" ? { glob: message.glob } : {}),
        });
      }
      parentPort?.postMessage({
        id,
        result: { text: result.css, dependencies },
      });
    } catch (error) {
      parentPort?.postMessage({
        id,
        error: detail(error),
        ...(error instanceof PostcssError ? { postcss: error.failure } : {}),
      });
    }
  },
);
