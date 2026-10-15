import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { NATIVE_TARGETS } from "../scripts/release/targets.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

interface Job {
  needs?: string[];
  if?: string;
  env?: Record<string, string | number>;
  permissions?: Record<string, string>;
  strategy?: {
    "fail-fast": boolean;
    matrix: { include: { target: string; triple: string; runner: string }[] };
  };
  steps: {
    name?: string;
    run?: string;
    uses?: string;
    with?: Record<string, unknown>;
  }[];
}

test("native release jobs build locked targets and gate publication on the matrix", async () => {
  const workflow = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/release.yml"),
      "utf8",
    ),
  ) as { jobs: Record<string, Job> };
  const native = Object.values(workflow.jobs).find((job) =>
    job.steps.some((step) =>
      step.run?.includes("scripts/release/build-native.mjs"),
    ),
  );
  assert.ok(native?.strategy);
  assert.equal(native.strategy["fail-fast"], false);
  assert.equal(native.env?.CARGO_BUILD_JOBS, 4);
  const rows = native.strategy.matrix.include;
  assert.equal(new Set(rows.map(({ target }) => target)).size, rows.length);
  for (const row of rows) {
    const target = NATIVE_TARGETS.find(({ target }) => target === row.target);
    assert.ok(target);
    assert.equal(row.triple, target.triple);
  }
  assert.ok(
    native.steps.some((step) =>
      step.run?.includes("scripts/release/inspect-native.mjs"),
    ),
  );
  assert.ok(
    native.steps.some(
      (step) =>
        step.uses?.startsWith("actions/upload-artifact@") &&
        step.with?.["include-hidden-files"] === true,
    ),
  );
  const publish = workflow.jobs.publish!;
  assert.ok(publish.needs?.includes("build-native"));
  assert.match(publish.if!, /needs\.build-native\.result == 'success'/);
  assert.ok(
    publish.steps.some(
      (step) =>
        step.uses?.startsWith("actions/download-artifact@") &&
        step.with?.["merge-multiple"] === true,
    ),
  );
  assert.equal(native.permissions?.["id-token"], undefined);
});
