import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return Object.fromEntries(Object.entries(value));
}

function list(value: unknown): UnknownRecord[] {
  assert.ok(Array.isArray(value));
  return value.map(record);
}

test("tag-free release checks stay read-only and cover all seven packages", async () => {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows/release-check.yml"),
    "utf8",
  );
  const workflow = record(parse(source));
  assert.equal(workflow.name, "Release checks");
  const triggers = record(workflow.on);
  assert.deepEqual(record(triggers.push).branches, [
    "rebuild/ci-release-check",
  ]);
  assert.ok("workflow_dispatch" in triggers);
  assert.deepEqual(workflow.permissions, { contents: "read" });

  const jobs = record(workflow.jobs);
  assert.deepEqual(Object.keys(jobs).sort(), [
    "build-native",
    "package-and-smoke",
  ]);
  const build = record(jobs["build-native"]);
  const matrix = record(record(build.strategy).matrix);
  assert.deepEqual(
    list(matrix.include).map((row) => row.target),
    [
      "linux-x64-gnu",
      "linux-arm64-gnu",
      "darwin-arm64",
      "win32-x64-msvc",
      "darwin-x64",
    ],
  );
  assert.equal(build["timeout-minutes"], 60);
  const buildSteps = list(build.steps);
  const checkout = buildSteps.find((step) =>
    String(step.uses).includes("/checkout@"),
  );
  assert.equal(record(checkout?.with).ref, "${{ github.sha }}");
  assert.equal(record(checkout?.with)["persist-credentials"], false);
  assert.equal(
    buildSteps.find((step) => step.name === "Build and pack native archive")
      ?.run,
    'node scripts/release/build-native.mjs "$RELEASE_TARGET"',
  );
  assert.equal(
    buildSteps.find((step) => step.name === "Inspect native TLS")?.run,
    'node scripts/release/inspect-native.mjs "$RELEASE_TARGET"',
  );
  assert.ok(
    buildSteps.some((step) =>
      String(step.uses).startsWith("actions/upload-artifact@"),
    ),
  );

  const aggregate = record(jobs["package-and-smoke"]);
  assert.deepEqual(aggregate.needs, ["build-native"]);
  assert.equal(aggregate["timeout-minutes"], 60);
  const aggregateSteps = list(aggregate.steps);
  const aggregateCheckout = aggregateSteps.find((step) =>
    String(step.uses).includes("/checkout@"),
  );
  assert.equal(record(aggregateCheckout?.with).ref, "${{ github.sha }}");
  assert.equal(record(aggregateCheckout?.with)["persist-credentials"], false);
  assert.equal(
    aggregateSteps.find((step) => step.name === "Pack seven release packages")
      ?.run,
    "node scripts/release/pack.mjs .context/release-artifact",
  );
  assert.equal(
    aggregateSteps.find(
      (step) => step.name === "Recheck seven release packages",
    )?.run,
    "node scripts/release/pack.mjs .context/release-artifact --reuse",
  );
  assert.equal(
    aggregateSteps.find(
      (step) => step.name === "Smoke-test seven release packages",
    )?.run,
    "node scripts/release/smoke.mjs .context/release-artifact",
  );

  const commands = [...buildSteps, ...aggregateSteps]
    .map((step) => String(step.run ?? ""))
    .join("\n");
  assert.doesNotMatch(commands, /npm publish|publish-native|release\.yml/);
  assert.doesNotMatch(source, /secrets\.|id-token|environment:/);
});
