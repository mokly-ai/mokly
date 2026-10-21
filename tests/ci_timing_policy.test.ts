import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

test("CI job limits keep the measured three-times timing contract", async () => {
  const workflow = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/ci.yml"),
      "utf8",
    ),
  ) as {
    jobs: Record<string, { "timeout-minutes"?: unknown }>;
  };
  const limits = Object.fromEntries(
    Object.entries(workflow.jobs).map(([name, job]) => [
      name,
      job["timeout-minutes"],
    ]),
  );
  assert.deepEqual(limits, {
    repository: 75,
    viewer: 40,
    browser: 60,
    native: 60,
    "static-delivery": 60,
    required: 30,
  });
});
