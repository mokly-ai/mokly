import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCancelledScenario,
  cancellationScenario,
  CANCELLATION_LINE,
} from "./helpers/publish_pre_installation_cancellation.js";

for (const mode of ["committed", "derived"] as const) {
  test(
    `${mode} publish cancels when esbuild exits before the signal listener runs`,
    { skip: process.platform === "win32" },
    async (context) => {
      const scenario = await cancellationScenario(
        context,
        mode,
        "compile",
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

test(
  "diagnostic publish cancellation keeps the compile failure stack",
  { skip: process.platform === "win32" },
  async (context) => {
    const scenario = await cancellationScenario(
      context,
      "committed",
      "compile",
      "plain",
      true,
    );
    assert.equal(scenario.result.code, 1);
    assert.equal(scenario.result.signal, null);
    assert.equal(scenario.result.stdout, "");
    assert.ok(scenario.result.stderr.startsWith(CANCELLATION_LINE));
    assert.match(
      scenario.result.stderr.slice(CANCELLATION_LINE.length),
      /^MoklyError: \[mokly\/build-invalid\][^\n]*\n\s+at loadGraph .*\/(?:src|dist)\/build\/load_graph\.(?:ts|js)/u,
    );
    await assertCancelledScenario(scenario);
  },
);
