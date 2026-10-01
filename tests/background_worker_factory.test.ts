import assert from "node:assert/strict";
import test from "node:test";
import { Worker, type WorkerOptions } from "node:worker_threads";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { BackgroundCompilation } from "../src/server/demand/background.js";
import { backgroundInputs } from "../src/server/demand/background_inputs.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const mode of ["committed", "derived"] as const)
  for (const existing of [false, true])
    test(`${mode} ${existing ? "existing" : "fresh"} BackgroundCompilation sends compact mode-selected workerData`, async (context) => {
      const fixture = await componentReviewFixture(context, (source) => source);
      const runtime = {
        ...componentRuntime(fixture.after),
        config: { ...fixture.config, generatedOutput: mode },
      };
      const accepted = existing ? fixture.after : undefined;
      let captured: { url: URL; options: WorkerOptions } | undefined;
      const background = new BackgroundCompilation(
        runtime,
        accepted,
        (url, options) => {
          captured = { url, options };
          return new Worker(
            'require("node:worker_threads").parentPort.on("message", () => {});',
            { ...options, eval: true },
          );
        },
      );
      fixture.beforeRemove(() => background.close());
      assert.ok(captured, "the constructor must use the injected factory");
      assert.ok(captured.url.pathname.endsWith("/background_worker.js"));
      const { pause, debug, gitPort, ...input } = captured.options.workerData;
      assert.deepEqual(input, backgroundInputs(runtime, accepted));
      assert.deepEqual(input.runtime.outputs, []);
      assert.equal(
        input.existingOutputs,
        mode === "derived" && existing ? fixture.after.outputs : undefined,
      );
      assert.ok(pause instanceof SharedArrayBuffer);
      assert.equal(typeof debug, "boolean");
      assert.deepEqual(captured.options.transferList, [gitPort]);
      assert.deepEqual(captured.options.resourceLimits, {
        maxOldGenerationSizeMb: 1024,
      });
      if (existing) assert.equal(await background.compilation, accepted);
    });
