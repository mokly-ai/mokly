/** A single lower-priority background compilation; foreground requests can pause it. */
import { setImmediate, setTimeout } from "node:timers/promises";
import { parentPort, workerData, type MessagePort } from "node:worker_threads";

import type { ManifestV8 } from "@mokly/viewer/data";

import { compileRuntime } from "../../build/compile_runtime.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { GeneratedFile } from "../../build/generated_file.js";
import { runWithTimings, timeAsync } from "../../diagnostics/timings.js";
import { RepositoryCatalogueChangeClassifier } from "../component_changes.js";

import { BackgroundWorkerState } from "./background_state.js";
import { WorkerGitCommandRunner } from "./git_worker.js";

const inputs = workerData as {
  runtime: ComponentRuntime;
  pause: SharedArrayBuffer;
  debug: boolean;
  existingManifest?: ManifestV8;
  existingOutputs?: ReadonlyMap<string, GeneratedFile>;
  gitPort: MessagePort;
};
const { pause, debug, existingManifest, gitPort } = inputs;
const classifier = new RepositoryCatalogueChangeClassifier(
  new WorkerGitCommandRunner(gitPort),
);
const pauseState = new Int32Array(pause);
const checkpoint = async () => {
  await setImmediate();
  while (Atomics.load(pauseState, 0)) await setTimeout(20);
};
const state = new BackgroundWorkerState(inputs, checkpoint, {
  compile: compileRuntime,
  post: (message) => parentPort?.postMessage(message),
  classify: (config, manifest, base, accepted) =>
    timeAsync("changes.classify", () =>
      classifier.read(config, manifest, base, undefined, accepted),
    ),
});
if (!existingManifest)
  void runWithTimings(debug, "background", () => state.start());
parentPort?.on(
  "message",
  (message: { type: string; base: string; commit?: string }) => {
    if (message.type !== "classify" || !state.ready) return;
    void runWithTimings(debug, "background", () => state.classify(message));
  },
);
