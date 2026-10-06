import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { componentReviewFixture } from "./helpers/component_review_fixture.js";

test("comparison helpers require production links except the explicit M6 oracle", async (t) => {
  const fixture = await componentReviewFixture(t, (source) => source);
  const input = path.join(fixture.root, "comparison-context.json");
  await fs.writeFile(
    input,
    JSON.stringify({
      before: fixture.before.manifest,
      after: fixture.after.manifest,
      beforeFiles: [...fixture.before.outputs],
      afterFiles: [...fixture.after.outputs],
      config: fixture.config,
      changedPaths: [],
    }),
  );
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--experimental-test-module-mocks",
    "--import",
    "tsx",
    fileURLToPath(
      new URL("./helpers/comparison_context_probe.mjs", import.meta.url),
    ),
    input,
  ]);
  const counts = JSON.parse(stdout) as { production: number; oracle: number };
  assert.ok(counts.production > 0);
  assert.ok(counts.oracle > 0);
});
