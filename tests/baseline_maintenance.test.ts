import assert from "node:assert/strict";
import test from "node:test";

import { StderrBaselineMaintenanceReporter } from "../packages/mokly/dist/baseline/maintenance.js";

test("maintenance diagnostics identify the entry and preserve the failure message", () => {
  const lines: string[] = [];
  const reporter = new StderrBaselineMaintenanceReporter((line) => {
    lines.push(line);
  });
  reporter.report({
    entry: "/cache/commit/source",
    error: new Error("removal denied"),
  });
  assert.deepEqual(lines, [
    "[mokly/baseline-cleanup] /cache/commit/source: removal denied\n",
  ]);
});

test("a closed diagnostic stream cannot replace a build's outcome", () => {
  const reporter = new StderrBaselineMaintenanceReporter(() => {
    throw new Error("stream closed");
  });
  assert.doesNotThrow(() =>
    reporter.report({
      entry: "/cache/commit/lock",
      error: new Error("release failed"),
    }),
  );
});
