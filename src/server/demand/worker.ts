/** Consumer execution is isolated from HTTP and terminable on timeout or shutdown. */
import { parentPort, workerData } from "node:worker_threads";

import {
  runtimeGraph,
  type ComponentRuntime,
} from "../../build/component_runtime.js";
import { DocumentCompiler } from "../../build/document_compiler.js";
import { errorMessage } from "../../errors.js";

const runtime = workerData as ComponentRuntime;
const compiler = new DocumentCompiler(runtime, runtimeGraph(runtime));
parentPort?.on("message", (route: string) => {
  try {
    parentPort?.postMessage({ ok: true, document: compiler.render(route) });
  } catch (error) {
    parentPort?.postMessage({ ok: false, error: errorMessage(error) });
  }
});
