/** A single lower-priority background compilation; foreground requests can pause it. */
import { setImmediate, setTimeout } from "node:timers/promises";
import { parentPort, workerData, type MessagePort } from "node:worker_threads";

import type { ManifestV10 } from "@mokly/viewer/data";

import type { BaselineCatalogue } from "../../baseline/catalogue.js";
import { compileRuntime } from "../../build/compile_runtime.js";
import type { ComponentRuntime } from "../../build/component_runtime.js";
import type { GeneratedFile } from "../../build/generated_file.js";
import { runWithTimings, timeAsync } from "../../diagnostics/timings.js";
import { errorMessage } from "../../errors.js";
import type { BaselineSelection } from "../../review/repository.js";
import { RepositoryCatalogueChangeClassifier } from "../component_changes.js";

import { WorkerGitCommandRunner } from "./git_worker.js";

const { runtime, pause, debug, existingManifest, existingOutputs, gitPort } =
  workerData as {
    runtime: ComponentRuntime;
    pause: SharedArrayBuffer;
    debug: boolean;
    existingManifest?: ManifestV10;
    existingOutputs?: ReadonlyMap<string, GeneratedFile>;
    gitPort: MessagePort;
  };
const classifier = new RepositoryCatalogueChangeClassifier(
  new WorkerGitCommandRunner(gitPort),
);
const state = new Int32Array(pause);
let manifest: ManifestV10 | undefined = existingManifest;
let outputs = existingOutputs;
const checkpoint = async () => {
  await setImmediate();
  while (Atomics.load(state, 0)) await setTimeout(20);
};
if (!existingManifest)
  void runWithTimings(debug, "background", async () => {
    try {
      const compilation = await compileRuntime(runtime, checkpoint, (warning) =>
        parentPort?.postMessage({
          type: "warning",
          generation: runtime.warningGeneration,
          warning,
        }),
      );
      manifest = compilation.manifest;
      outputs = compilation.outputs;
      parentPort?.postMessage({ type: "compiled", compilation });
    } catch (error) {
      parentPort?.postMessage({ type: "failed", error: errorMessage(error) });
    }
  });
parentPort?.on(
  "message",
  (message: {
    type: string;
    base: string;
    commit?: string;
    selection?: BaselineSelection;
    descriptor?: BaselineCatalogue;
  }) => {
    if (message.type !== "classify" || !manifest) return;
    void runWithTimings(debug, "background", async () => {
      if (!message.commit || !message.selection) {
        parentPort?.postMessage({ type: "classified" });
        return;
      }
      const commit = message.commit;
      const selection = message.selection;
      await checkpoint();
      const classification = await timeAsync("changes.classify", () =>
        classifier.read(runtime.config, manifest!, message.base, undefined, {
          commit,
          selection,
          ...(message.descriptor ? { descriptor: message.descriptor } : {}),
          generation: {
            routes: runtime.styleOutputs.map(([route]) => route),
            ...(outputs ? { outputs } : {}),
            deliveredStyleSources: runtime.deliveredStyleSources,
            documentMarkdown: new Map(
              (runtime.bundle.documents ?? []).map((entry) => [
                entry.sourceRelativePath,
                entry.markdown,
              ]),
            ),
          },
        }),
      );
      parentPort?.postMessage({ type: "classified", snapshot: classification });
    });
  },
);
