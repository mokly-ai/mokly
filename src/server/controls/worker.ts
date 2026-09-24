/** The consumer render adapter runs only in this terminable worker. */
import { parentPort, workerData } from "node:worker_threads";

import type { ComponentRenderRequest } from "@mokly/viewer/data";

import {
  runtimeGraph,
  type ComponentRuntime,
} from "../../build/component_runtime.js";
import { errorMessage } from "../../errors.js";

import { renderTransient } from "./transient.js";

const runtime = workerData as ComponentRuntime;
const graph = runtimeGraph(runtime);
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
