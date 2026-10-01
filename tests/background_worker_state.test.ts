import assert from "node:assert/strict";
import test from "node:test";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { backgroundInputs } from "../src/server/demand/background_inputs.js";
import {
  BackgroundWorkerState,
  type BackgroundWorkerMessage,
} from "../src/server/demand/background_state.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const mode of ["committed", "derived"] as const)
  for (const existing of [false, true])
    test(`${mode} ${existing ? "existing" : "fresh"} worker state releases input roots and classifies with only required outputs`, async (context) => {
      const fixture = await componentReviewFixture(context, (source) => source);
      const runtime = {
        ...componentRuntime(fixture.after),
        config: { ...fixture.config, generatedOutput: mode },
      };
      const inputs = backgroundInputs(
        runtime,
        existing ? fixture.after : undefined,
      );
      const messages: BackgroundWorkerMessage[] = [];
      let compileCalls = 0;
      let classifyCalls = 0;
      let checkpoints = 0;
      const checkpoint = async () => {
        checkpoints++;
      };
      if (existing && mode === "derived")
        assert.equal(inputs.existingOutputs, fixture.after.outputs);
      const state = new BackgroundWorkerState(inputs, checkpoint, {
        compile: async (supplied, check) => {
          compileCalls++;
          assert.equal(supplied, inputs.runtime);
          assert.equal(check, checkpoint);
          return fixture.after;
        },
        post: (message) => messages.push(message),
        classify: async (config, manifest, base, accepted) => {
          classifyCalls++;
          assert.equal(config, runtime.config);
          assert.equal(manifest, fixture.after.manifest);
          assert.equal(base, "main");
          assert.deepEqual(
            Object.keys(accepted).sort(),
            mode === "derived" ? ["commit", "outputs"] : ["commit"],
          );
          assert.equal(accepted.commit, "a".repeat(40));
          assert.equal(
            accepted.outputs,
            mode === "derived" ? fixture.after.outputs : undefined,
          );
          return undefined;
        },
      });
      assert.equal(Object.hasOwn(inputs, "existingOutputs"), false);
      assert.equal(state.ready, existing);
      if (!existing) {
        await state.classify({ base: "main", commit: "a".repeat(40) });
        assert.equal(classifyCalls, 0);
      }
      await state.start();
      assert.equal(state.ready, true);
      assert.equal(compileCalls, existing ? 0 : 1);
      if (existing) assert.deepEqual(messages, []);
      else {
        assert.equal(messages.length, 1);
        const message = messages[0];
        assert.equal(message?.type, "compiled");
        if (message?.type !== "compiled") return;
        assert.equal(message.compilation, fixture.after);
        assert.equal(message.compilation.outputs, fixture.after.outputs);
      }
      await state.classify({ base: "main", commit: "a".repeat(40) });
      assert.equal(classifyCalls, 1);
      assert.equal(checkpoints, 1);
      assert.deepEqual(messages.at(-1), {
        type: "classified",
        snapshot: undefined,
      });
      if (mode === "derived") {
        await state.classify({ base: "main" });
        assert.equal(classifyCalls, 1);
        assert.equal(checkpoints, 1);
        assert.deepEqual(messages.at(-1), { type: "classified" });
      }
    });

test("worker state reports compilation failure without becoming ready", async (context) => {
  const fixture = await componentReviewFixture(context, (source) => source);
  const messages: BackgroundWorkerMessage[] = [];
  const state = new BackgroundWorkerState(
    backgroundInputs(componentRuntime(fixture.after)),
    async () => {},
    {
      compile: async () => {
        throw new Error("broken compilation");
      },
      post: (message) => messages.push(message),
      classify: async () => assert.fail("an unready worker cannot classify"),
    },
  );
  await state.start();
  await state.classify({ base: "main" });
  assert.equal(state.ready, false);
  assert.deepEqual(messages, [{ type: "failed", error: "broken compilation" }]);
});
