/** The consumer render adapter runs only in this terminable worker. */
import { parentPort, workerData } from "node:worker_threads";

import type { ComponentRenderRequest } from "@mokly/viewer/data";

import type { ComponentRuntime } from "../../build/component_runtime.js";
import { evaluateBundle } from "../../build/consumer_bundle.js";
import { errorMessage } from "../../errors.js";

import { renderTransient } from "./transient.js";

const runtime = workerData as ComponentRuntime;
const graph = {
  ...evaluateBundle(runtime.bundle),
  entrySources: runtime.bundle.entrySources,
};
parentPort?.on("message", (request: ComponentRenderRequest) => {
  try {
    parentPort?.postMessage({
      ok: true,
      result: renderTransient(runtime, graph, request),
    });
  } catch (error) {
    parentPort?.postMessage({ ok: false, reason: errorMessage(error) });
  }
});
