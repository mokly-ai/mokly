import assert from "node:assert/strict";
import test from "node:test";

import { componentRuntime } from "../dist/build/component_runtime.js";
import { prepareLiveRuntime } from "../dist/build/live_runtime.js";
import {
  backgroundInputs,
  classificationOutputs,
} from "../src/server/demand/background_inputs.js";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

for (const mode of ["committed", "derived"] as const)
  test(`${mode} helpers select classification outputs and compact worker inputs`, async (context) => {
    const fixture = await componentReviewFixture(context, (source) => source);
    const compilation = fixture.after;
    assert.ok(compilation.outputs.size > 1);
    assert.equal(
      classificationOutputs({ generatedOutput: mode }, compilation.outputs),
      mode === "derived" ? compilation.outputs : undefined,
    );
    const runtime = {
      ...componentRuntime(compilation),
      config: { ...fixture.config, generatedOutput: mode },
    };
    assert.ok(runtime.outputs.length > 0);
    const inputs = backgroundInputs(runtime, compilation);
    assert.deepEqual(inputs.runtime.outputs, []);
    assert.equal(inputs.runtime.manifest.schemaVersion, "live-index-1");
    assert.equal(inputs.existingManifest, compilation.manifest);
    assert.equal(
      inputs.existingOutputs,
      mode === "derived" ? compilation.outputs : undefined,
    );
    assert.ok(
      runtime.outputs.length > 0,
      "parent adoption output is preserved",
    );
    const fresh = backgroundInputs(runtime);
    assert.deepEqual(fresh.runtime.outputs, []);
    assert.equal(fresh.existingOutputs, undefined);
    assert.equal(fresh.existingManifest, undefined);
  });

test("a live runtime cannot smuggle rendered output into the worker input", async (context) => {
  const fixture = await componentReviewFixture(context, (source) => source);
  const runtime = await prepareLiveRuntime(fixture.config);
  const outputs = [["document.html", "not required by compilation"]] as const;
  const inputs = backgroundInputs({ ...runtime, outputs });
  assert.deepEqual(inputs.runtime.outputs, []);
  assert.equal(runtime.manifest, inputs.runtime.manifest);
});
