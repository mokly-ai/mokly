import { parentPort, workerData } from "node:worker_threads";

import type { CssResult } from "../generated/sidecar/CssResult.js";
import type { ProcessCssParams } from "../generated/sidecar/ProcessCssParams.js";

import { detail } from "./errors.js";
import { loadPostcss } from "./postcss-loader.js";
import { configureResolution, loadedFiles } from "./postcss-resolution.js";

configureResolution(workerData.sourceRoot, workerData.moduleResolution);
const configuration = loadPostcss(
  workerData.postcss,
  workerData.sourceRoot,
  workerData.moduleResolution,
);
configuration.catch(() => {});
parentPort?.on(
  "message",
  async ({ id, params }: { id: number; params: ProcessCssParams }) => {
    try {
      const { processor, modules } = await configuration;
      const result = await processor.process(params.text, {
        from: params.sourcePath,
        map: false,
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
          throw new Error(
            `PostCSS plugin ${message.plugin ?? "unknown"} reported an invalid dependency for ${params.sourcePath}; report a file or directory path and optional glob`,
          );
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
      parentPort?.postMessage({ id, error: detail(error) });
    }
  },
);
