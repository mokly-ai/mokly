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
    matrix?: Readonly<Record<string, unknown>> & {
      include?: readonly Readonly<Record<string, unknown>>[];
    };
  };
}

interface Workflow {
  jobs?: Readonly<Record<string, WorkflowJob>>;
}

const STANDARD_RUNNERS = [
  "ubuntu-24.04",
  "ubuntu-24.04-arm",
  "windows-2025",
  "macos-26",
];
/** Workflows whose native build matrix may run `darwin-x64` on Intel macOS. */
const INTEL_MACOS_WORKFLOWS = [
  "release.yml",
  "release-check.yml",
  "native-bootstrap.yml",
];

test("workflows use free GitHub-hosted standard runners except the Blacksmith Testbox", async () => {
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
        // A called workflow has no runner of its own. This audit reads the
        // called file too, so only a local workflow that it reads may run.
        const called = /^\.\/\.github\/workflows\/([^/@]+)$/.exec(job.uses);
        assert.ok(called, `${context} calls only local workflows`);
        assert.ok(
          workflowNames.includes(called[1]!),
          `${context} calls an audited workflow`,
        );
        continue;
      }
      const runsOn = job["runs-on"];
      assert.ok(typeof runsOn === "string", `${context} runner`);
      if (context === "blacksmith-testbox.yml:testbox") {
        assert.equal(
          runsOn,
          "blacksmith-4vcpu-ubuntu-2404",
          `${context} runner`,
        );
        continue;
      }
      if (publishesWithProvenance(job)) {
        provenancePublishers.push(context);
        assert.equal(
          runsOn,
          "ubuntu-24.04",
          `${context} must publish from a GitHub-hosted runner`,
        );
        continue;
      }
      const matrixReference = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/.exec(runsOn);
      if (!matrixReference) {
        assert.ok(
          STANDARD_RUNNERS.includes(runsOn),
          `${context} must use a free GitHub-hosted standard runner`,
        );
        continue;
      }

      const key = matrixReference[1]!;
      const values =
        job.strategy?.matrix?.[key] ??
        job.strategy?.matrix?.include?.map((row) => row[key]);
      assert.ok(Array.isArray(values), `${context} runner matrix`);
      for (const value of values) {
        assert.ok(typeof value === "string", `${context} runner matrix value`);
        if (value === "macos-26-intel") {
          assert.ok(INTEL_MACOS_WORKFLOWS.includes(workflowName), context);
          assert.equal(jobName, "build-native", context);
          const rows = job.strategy?.matrix?.include;
          assert.ok(rows, `${context} must define target rows`);
          assert.deepEqual(
            rows.filter((row) => row[key] === value).map((row) => row.target),
            ["darwin-x64"],
            `${context} must use Intel macOS only for darwin-x64`,
          );
        } else
          assert.ok(
            STANDARD_RUNNERS.includes(value),
            `${context} must use a free GitHub-hosted standard runner`,
          );
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
