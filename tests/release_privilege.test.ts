import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(
    typeof value === "object" && value !== null && !Array.isArray(value),
  );
  return Object.fromEntries(Object.entries(value));
}

async function workflow(name: string) {
  const value: unknown = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows", name),
      "utf8",
    ),
  );
  return record(value);
}

function steps(job: Record<string, unknown>) {
  assert.ok(Array.isArray(job.steps));
  return job.steps.map((step: unknown) => record(step));
}

test("release audit and builds complete without publication credentials", async () => {
  const main = await workflow("release.yml");
  const jobs = record(main.jobs);
  const publish = record(jobs.publish);
  const prepare = record(jobs["prepare-release"]);
  assert.deepEqual(prepare.permissions, { actions: "read", contents: "read" });
  assert.equal(prepare.secrets, undefined);
  assert.equal(prepare.uses, "./.github/workflows/release-prepare.yml");
  assert.ok(
    Array.isArray(publish.needs) && publish.needs.includes("prepare-release"),
  );
  assert.match(
    String(publish.if),
    /needs\.prepare-release\.result == 'success'/,
  );

  const called = await workflow("release-prepare.yml");
  assert.deepEqual(called.permissions, { actions: "read", contents: "read" });
  const builder = record(record(called.jobs).prepare);
  assert.equal(builder.environment, undefined);
  const preparation = steps(builder);
  for (const name of [
    "Audit Rust dependencies",
    "Run complete verification",
    "Prepare exact publish artifacts",
    "Smoke-test exact publish artifacts",
  ])
    assert.ok(
      preparation.some((step) => step.name === name),
      name,
    );
  assert.equal(
    preparation.find((step) => step.name === "Audit Rust dependencies")?.if,
    undefined,
  );
  assert.equal(
    record(
      preparation.find((step) => String(step.uses).includes("/checkout@"))
        ?.with,
    )["persist-credentials"],
    false,
  );

  const publication = steps(publish);
  const commands = publication.map((step) => String(step.run ?? "")).join("\n");
  assert.doesNotMatch(
    commands,
    /\bcargo\b|\brustup\b|dependencies:check:rust|smoke\.mjs/,
  );
  assert.ok(publication.some((step) => step.run === "npm ci --ignore-scripts"));
  assert.doesNotMatch(commands, /npm ci(?:\s*$|\s*\n)/);
  assert.ok(
    publication.some(
      (step) =>
        step.run ===
        "node scripts/release/pack.mjs .context/release-artifact --reuse",
    ),
  );
  assert.equal(
    record(
      publication.find((step) => String(step.uses).includes("/checkout@"))
        ?.with,
    )["persist-credentials"],
    false,
  );
  const download = publication.find((step) =>
    String(step.uses).startsWith("actions/download-artifact@"),
  );
  assert.equal(
    record(download?.with)["run-id"],
    "${{ needs.prepare-release.outputs.artifact_run_id }}",
  );
  assert.equal(
    record(download?.with).name,
    "${{ needs.prepare-release.outputs.artifact_name }}",
  );
  assert.ok(
    !publication.some((step) =>
      String(step.uses).startsWith("actions/upload-artifact@"),
    ),
  );
});
