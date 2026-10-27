import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

interface WorkflowJob {
  uses?: string;
  permissions?: Readonly<Record<string, string>>;
  "runs-on"?: unknown;
  steps?: readonly { run?: string }[];
  strategy?: {
    matrix?: Readonly<Record<string, unknown>>;
  };
}

interface Workflow {
  jobs?: Readonly<Record<string, WorkflowJob>>;
}

/** npm trusted publishing creates provenance only on GitHub-hosted runners. */
const PROVENANCE_PUBLISH_RUNNER = "ubuntu-24.04";
/** Linux jobs above the smallest tier: the design matrix and CI Rust builds. */
const LARGER_LINUX_RUNNERS: Readonly<Record<string, string>> = {
  "design-attribution.yml:design-attribution": "blacksmith-8vcpu-ubuntu-2404",
  "ci.yml:repository": "blacksmith-8vcpu-ubuntu-2404",
  "ci.yml:viewer": "blacksmith-8vcpu-ubuntu-2404",
  "ci.yml:browser": "blacksmith-8vcpu-ubuntu-2404",
  "ci.yml:static-delivery": "blacksmith-8vcpu-ubuntu-2404",
};
/** CI's Windows native job compiles and tests the whole Rust workspace. */
const CI_WINDOWS_NATIVE_RUNNER = "blacksmith-8vcpu-windows-2025";
/** Workflows whose native build matrix may run `darwin-x64` on Intel macOS. */
const INTEL_MACOS_WORKFLOWS = [
  "release.yml",
  "release-check.yml",
  "native-bootstrap.yml",
];

test("workflows use the smallest Blacksmith tiers and publish to npm from GitHub-hosted runners", async () => {
  const workflowsDirectory = path.join(repositoryRoot, ".github", "workflows");
  const workflowNames = (await fs.readdir(workflowsDirectory)).filter(
    (name) => name.endsWith(".yml") || name.endsWith(".yaml"),
  );
  assert.ok(workflowNames.length > 0);
  const provenancePublishers: string[] = [];

  for (const workflowName of workflowNames) {
    const source = await fs.readFile(
      path.join(workflowsDirectory, workflowName),
      "utf8",
    );
    const workflow = parse(source) as Workflow;
    assert.ok(workflow.jobs, `${workflowName} must define jobs`);

    for (const [jobName, job] of Object.entries(workflow.jobs)) {
      const context = `${workflowName}:${jobName}`;
      if (job.uses) {
        assert.equal(context, "release.yml:prepare-release");
        assert.equal(job.uses, "./.github/workflows/release-prepare.yml");
        continue;
      }
      const runsOn = job["runs-on"];
      assert.ok(typeof runsOn === "string", `${context} runner`);
      const largerRunner = LARGER_LINUX_RUNNERS[context];
      if (largerRunner) {
        assert.equal(runsOn, largerRunner, `${context} runner`);
        continue;
      }
      if (publishesWithProvenance(job)) {
        provenancePublishers.push(context);
        assert.equal(
          runsOn,
          PROVENANCE_PUBLISH_RUNNER,
          `${context} must publish from a GitHub-hosted runner`,
        );
        continue;
      }
      const matrixReference = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/.exec(runsOn);
      if (!matrixReference) {
        assertMinimumRunner(runsOn, context);
        continue;
      }

      const key = matrixReference[1]!;
      const values =
        job.strategy?.matrix?.[key] ??
        (
          job.strategy?.matrix?.include as Record<string, unknown>[] | undefined
        )?.map((row) => row[key]);
      assert.ok(Array.isArray(values), `${context} runner matrix`);
      for (const value of values) {
        assert.ok(typeof value === "string", `${context} runner matrix value`);
        if (
          INTEL_MACOS_WORKFLOWS.includes(workflowName) &&
          jobName === "build-native" &&
          value === "macos-26-intel"
        ) {
          const rows = job.strategy?.matrix?.include as Record<
            string,
            unknown
          >[];
          assert.deepEqual(
            rows.filter((row) => row[key] === value).map((row) => row.target),
            ["darwin-x64"],
          );
        } else if (
          context === "ci.yml:native" &&
          value.endsWith("-windows-2025")
        ) {
          assert.equal(value, CI_WINDOWS_NATIVE_RUNNER);
        } else assertMinimumRunner(value, context);
      }
    }
  }
  assert.deepEqual(provenancePublishers, ["release.yml:publish"]);
});

function publishesWithProvenance(job: WorkflowJob): boolean {
  return (
    job.permissions?.["id-token"] === "write" &&
    (job.steps ?? []).some((step) => /\bnpm publish\b/.test(step.run ?? ""))
  );
}

function assertMinimumRunner(label: string, context: string): void {
  const match = /^blacksmith-(\d+)vcpu-(.+)$/.exec(label);
  assert.ok(match, `${context} must use a sized Blacksmith runner`);
  const expected = match[2]!.startsWith("macos-") ? 6 : 2;
  assert.equal(
    Number(match[1]),
    expected,
    `${context} must use the smallest ${match[2]} runner`,
  );
}
