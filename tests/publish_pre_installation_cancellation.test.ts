import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCancelledScenario,
  cancellationScenario,
  CANCELLATION_LINE,
} from "./helpers/publish_pre_installation_cancellation.js";

for (const storage of ["blobs", "rebuild"] as const) {
  for (const phase of ["comparison", "staging", "input-recheck"] as const) {
    test(
      `${storage} publish cancels during ${phase}`,
      { skip: process.platform === "win32" },
      async (context) => {
        const scenario = await cancellationScenario(
          context,
          storage,
          phase,
          "plain",
        );
        assert.deepEqual(scenario.result, {
          code: 1,
          signal: null,
          stderr: CANCELLATION_LINE,
          stdout: "",
        });
        await assertCancelledScenario(scenario);
      },
    );
  }
}

test(
  "publish cancels during configuration loading",
  { skip: process.platform === "win32" },
  async (context) => {
    const scenario = await cancellationScenario(
      context,
      "blobs",
      "configuration",
      "plain",
    );
    assert.deepEqual(scenario.result, {
      code: 1,
      signal: null,
      stderr: CANCELLATION_LINE,
      stdout: "",
    });
    await assertCancelledScenario(scenario);
  },
);

test(
  "rich publish cancels during staging",
  { skip: process.platform === "win32" },
  async (context) => {
    const scenario = await cancellationScenario(
      context,
      "blobs",
      "staging",
      "rich",
    );
    assert.equal(scenario.result.code, 1);
    assert.equal(scenario.result.signal, null);
    assert.match(scenario.result.stdout, /Exporting catalogue/u);
    assert.equal(
      scenario.result.stderr,
      "  ✖ Publication was cancelled.  [mokly/upload-failed]\n" +
        "    Run mokly publish again when you are ready.\n",
    );
    await assertCancelledScenario(scenario);
  },
);
