/** Isolated PostCSS runtime: plugin package module state belongs to one graph load. */
import { parentPort, workerData } from "node:worker_threads";

import { FileSystemPostcssConfigLoader } from "../../config/postcss_loader.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError, errorMessage } from "../../errors.js";

import { PostcssStyleProcessor } from "./postcss.js";

interface Request {
  readonly id: number;
  readonly source: string;
  readonly text: string;
}

const channel = parentPort;
if (!channel) throw new Error("PostCSS worker requires a parent channel");

try {
  const config = workerData as ResolvedConfig;
  const plugins = await new FileSystemPostcssConfigLoader().load(config);
  const processor = new PostcssStyleProcessor(config, plugins);
  channel.postMessage({ id: 0 });
  channel.on("message", async (request: Request) => {
    try {
      const result = await processor.process(request.source, request.text);
      channel.postMessage({ id: request.id, result });
    } catch (error) {
      channel.postMessage({
        id: request.id,
        error: {
          code: error instanceof MoklyError ? error.code : "build-invalid",
          message: errorMessage(error),
        },
      });
    }
  });
} catch (error) {
  channel.postMessage({
    id: 0,
    error: {
      code: error instanceof MoklyError ? error.code : "config-invalid",
      message: errorMessage(error),
    },
  });
}
