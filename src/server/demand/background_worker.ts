/** A single lower-priority background compilation; foreground requests can pause it. */
import { setImmediate, setTimeout } from "node:timers/promises";
import { parentPort, workerData, type MessagePort } from "node:worker_threads";

import type { ManifestV7 } from "@mokly/viewer/data";

import { compileRuntime } from "../../build/compile_runtime.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import { runWithTimings, timeAsync } from "../../diagnostics/timings.js";
import { errorMessage } from "../../errors.js";
import { RepositoryCatalogueChangeClassifier } from "../component_changes.js";

import { classificationOutputs } from "./background_inputs.js";
import { WorkerGitCommandRunner } from "./git_worker.js";

const inputs = workerData as {
  runtime: ComponentRuntime;
  pause: SharedArrayBuffer;
  debug: boolean;
  existingManifest?: ManifestV7;
  existingOutputs?: ReadonlyMap<string, string>;
  gitPort: MessagePort;
};
const { runtime, pause, debug, existingManifest, gitPort } = inputs;
const classifier = new RepositoryCatalogueChangeClassifier(
  new WorkerGitCommandRunner(gitPort),
);
const state = new Int32Array(pause);
let manifest: ManifestV7 | undefined = existingManifest;
let outputs = classificationOutputs(runtime.config, inputs.existingOutputs);
delete inputs.existingOutputs;
const checkpoint = async () => {
  await setImmediate();
  while (Atomics.load(state, 0)) await setTimeout(20);
};
if (!existingManifest)
  void runWithTimings(debug, "background", async () => {
    try {
      const compilation = await compileRuntime(runtime, checkpoint);
      manifest = compilation.manifest;
      parentPort?.postMessage({ type: "compiled", compilation });
      outputs = classificationOutputs(runtime.config, compilation.outputs);
    } catch (error) {
      parentPort?.postMessage({ type: "failed", error: errorMessage(error) });
    }
  });
parentPort?.on(
  "message",
  (message: { type: string; base: string; commit?: string }) => {
    if (message.type !== "classify" || !manifest) return;
    void runWithTimings(debug, "background", async () => {
      if (runtime.config.generatedOutput === "derived" && !message.commit) {
        parentPort?.postMessage({ type: "classified" });
        return;
      }
      await checkpoint();
      const classification = await timeAsync("changes.classify", () =>
        classifier.read(runtime.config, manifest!, message.base, undefined, {
          ...(message.commit ? { commit: message.commit } : {}),
          ...(outputs ? { outputs } : {}),
        }),
      );
      parentPort?.postMessage({ type: "classified", snapshot: classification });
    });
  },
);
