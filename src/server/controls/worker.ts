/** The consumer render adapter runs only in this terminable worker. */
import { parentPort, workerData } from "node:worker_threads";

import {
  runtimeGraph,
  type ComponentRuntime,
} from "../../build/component_runtime.js";
import { errorMessage } from "../../errors.js";

import { renderTransient } from "./transient.js";
import type { RenderWorkerRequest } from "./worker_client.js";

const runtime = workerData as ComponentRuntime;
const graph = runtimeGraph(runtime);
parentPort?.on("message", ({ request, moveTargets }: RenderWorkerRequest) => {
  try {
    parentPort?.postMessage({
      ok: true,
      result: renderTransient(runtime, graph, request, moveTargets),
    });
  } catch (error) {
    parentPort?.postMessage({ ok: false, reason: errorMessage(error) });
  }
});
