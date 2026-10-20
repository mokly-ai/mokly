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
    if?: string;
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
    job.steps?.some((step) =>
      step.run?.includes("scripts/release/build-native.mjs"),
    ),
  );
  assert.ok(native?.strategy);
  assert.equal(native.strategy["fail-fast"], false);

  const rows = native.strategy.matrix.include;
  assert.equal(new Set(rows.map(({ target }) => target)).size, rows.length);
  assert.deepEqual(
    rows.map(({ target }) => target).sort(),
    NATIVE_TARGETS.map(({ target }) => target).sort(),
  );
  assert.equal(
    rows.find(({ target }) => target === "darwin-x64")?.runner,
    "macos-26-intel",
  );
  assert.ok(native.steps.some(({ run }) => run === "npm ci --ignore-scripts"));
  assert.ok(
    native.steps.some(({ run }) =>
      run?.includes("scripts/release/verify-fresh.mjs"),
    ),
  );
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
        step.with?.["include-hidden-files"] === true &&
        step.with?.overwrite === true &&
        step.with?.["retention-days"] === 90,
    ),
  );
  const checkouts = native.steps.filter((step) =>
    step.uses?.includes("/checkout@"),
  );
  assert.equal(checkouts.length, 2);
  const intel = checkouts.find(
    (step) => step.if === "matrix.target == 'darwin-x64'",
  );
  const other = checkouts.find(
    (step) => step.if === "matrix.target != 'darwin-x64'",
  );
  assert.equal(
    intel?.uses,
    "actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10",
  );
  assert.equal(
    other?.uses,
    "useblacksmith/checkout@25227e61ff9dafe400e22fa487b673eac4e4409a",
  );
  for (const checkout of checkouts) {
    assert.equal(checkout.with?.["fetch-depth"], 0);
    assert.equal(
      checkout.with?.ref,
      "${{ needs.select-release.outputs.publish_ref }}",
    );
  }
  const publish = workflow.jobs.publish!;
  const preparation = workflow.jobs["prepare-release"]!;
  assert.ok(preparation.needs?.includes("build-native"));
  assert.ok(publish.needs?.includes("prepare-release"));
  const called = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows/release-prepare.yml"),
      "utf8",
    ),
  ) as { jobs: Record<string, Job> };
  const prepare = called.jobs.prepare!;
  const preserve = prepare.steps.find(
    (step) => step.name === "Preserve checked artifacts",
  );
  assert.equal(
    preserve?.if,
    "steps.publish_artifacts.outputs.artifact_run_id == ''",
  );
  assert.match(preparation.if!, /needs\.build-native\.result == 'success'/);
  assert.ok(
    prepare.steps.some(
      (step) =>
        step.uses?.startsWith("actions/download-artifact@") &&
        step.with?.["merge-multiple"] === true,
    ),
  );
  assert.equal(native.permissions?.["id-token"], undefined);
  assert.match(native.if!, /artifact_run_id == ''/);
  assert.ok(
    prepare.steps.some(
      (step) =>
        step.with?.["run-id"] ===
        "${{ steps.publish_artifacts.outputs.artifact_run_id }}",
    ),
  );
  assert.ok(
    prepare.steps.some((step) =>
      step.run?.includes("pack.mjs .context/release-artifact --reuse"),
    ),
  );
  for (const job of Object.values(workflow.jobs))
    assert.equal(job.env?.CARGO_BUILD_JOBS, undefined);
});
