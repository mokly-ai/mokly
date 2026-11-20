import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { runReleaseEvidence } from "../scripts/release/evidence.mjs";
import {
  classifyEvidence,
  selectCandidateRuns,
} from "../scripts/release/evidence_contract.mjs";
import { validateCiReports } from "../scripts/verification/aggregate.mjs";

import {
  gitExecutor,
  releaseReports,
  releaseRun,
  requiredJobs,
  TAG_COMMIT,
  TAG_TREE,
  nodeInventory,
  browserInventory,
  verificationArtifacts,
} from "./helpers/release_evidence.js";
import {
  evidenceEnvironment,
  githubFixture,
  temporaryRoot,
} from "./helpers/release_evidence_runtime.js";

test("candidate runs put the tag push before newest same-repository PR evidence", () => {
  const pull = {
    merged_at: "2026-09-22T10:20:00Z",
    merge_commit_sha: TAG_COMMIT,
    head: { sha: "c".repeat(40), repo: { full_name: "mokly-ai/mokly" } },
  };
  const runs = [
    releaseRun({ id: 1 }),
    releaseRun({
      id: 2,
      event: "pull_request",
      head_sha: pull.head.sha,
      updated_at: "2026-09-22T10:05:00Z",
    }),
    releaseRun({
      id: 3,
      event: "pull_request",
      head_sha: pull.head.sha,
      updated_at: "2026-09-22T10:15:00Z",
    }),
    releaseRun({ id: 4, conclusion: "failure" }),
    releaseRun({ id: 5, path: ".github/workflows/release.yml" }),
    releaseRun({ id: 6, head_repository: { full_name: "fork/mokly" } }),
    releaseRun({ id: 7, event: "pull_request", head_sha: "d".repeat(40) }),
  ];
  assert.deepEqual(
    selectCandidateRuns(runs, [pull], TAG_COMMIT, "mokly-ai/mokly").map(
      (run) => run.id,
    ),
    [1, 3, 2],
  );
});

test("evidence classification distinguishes unavailable, unrelated and invalid reports", () => {
  const reports = releaseReports();
  const base = {
    run: releaseRun(),
    jobs: requiredJobs(),
    artifacts: verificationArtifacts(),
    reports,
    taggedCommit: TAG_COMMIT,
    taggedTree: TAG_TREE,
    evidenceTree: TAG_TREE,
    liveNodeFiles: nodeInventory(reports),
    liveBrowserFiles: browserInventory(reports),
  };
  assert.equal(classifyEvidence(base, validateCiReports).outcome, "applicable");
  assert.equal(
    classifyEvidence(
      { ...base, jobs: requiredJobs("failure") },
      validateCiReports,
    ).outcome,
    "absent",
  );
  assert.equal(
    classifyEvidence(
      { ...base, artifacts: verificationArtifacts().slice(1) },
      validateCiReports,
    ).outcome,
    "absent",
  );
  assert.equal(
    classifyEvidence(
      { ...base, artifacts: verificationArtifacts().slice(0, 1) },
      validateCiReports,
    ).outcome,
    "absent",
  );
  assert.equal(
    classifyEvidence(
      { ...base, artifacts: verificationArtifacts(true) },
      validateCiReports,
    ).outcome,
    "absent",
  );
  assert.equal(
    classifyEvidence(
      {
        ...base,
        reports: releaseReports("c".repeat(40)),
        evidenceTree: "d".repeat(40),
      },
      validateCiReports,
    ).outcome,
    "absent",
  );

  const wrongBrowser = classifyEvidence(
    { ...base, liveBrowserFiles: ["tests/browser/missing.spec.ts"] },
    validateCiReports,
  );
  assert.equal(wrongBrowser.outcome, "invalid");
  assert.equal(
    wrongBrowser.reason,
    "browser report inventory does not match the release checkout",
  );
  const twoCommits = releaseReports();
  twoCommits[0] = { ...twoCommits[0]!, commit: "c".repeat(40) };
  assert.equal(
    classifyEvidence({ ...base, reports: twoCommits }, validateCiReports)
      .outcome,
    "invalid",
  );
  const failed = releaseReports();
  failed[0] = {
    ...failed[0]!,
    outcome: { status: "failed", exitCode: 1, signal: null },
  };
  assert.equal(
    classifyEvidence({ ...base, reports: failed }, validateCiReports).outcome,
    "invalid",
  );
  assert.equal(
    classifyEvidence(
      { ...base, liveNodeFiles: ["tests/missing.test.ts"] },
      validateCiReports,
    ).outcome,
    "invalid",
  );
});

test("entrypoint writes applicable evidence record and workflow output", async (t) => {
  const root = await temporaryRoot(t);
  const output = path.join(root, "github-output");
  const reports = releaseReports();
  const run = releaseRun();
  const record = await runReleaseEvidence({
    env: evidenceEnvironment(output),
    repositoryRoot: root,
    execute: gitExecutor(),
    createGithub: () => githubFixture(run),
    readReports: async () => reports,
    discoverNodeFiles: async () => nodeInventory(reports),
    discoverBrowserFiles: async () => browserInventory(reports),
  });
  assert.deepEqual(record, {
    mode: "evidence",
    outcome: "applicable",
    taggedCommit: TAG_COMMIT,
    taggedTree: TAG_TREE,
    selectedRunId: run.id,
    selectedRunUrl: run.html_url,
    evidenceCommit: TAG_COMMIT,
    reportCount: 10,
    reason: `run ${run.id} proves tagged tree ${TAG_TREE}`,
  });
  assert.deepEqual(
    JSON.parse(
      await fs.readFile(
        path.join(root, ".context/release-evidence/record.json"),
        "utf8",
      ),
    ),
    record,
  );
  assert.equal(await fs.readFile(output, "utf8"), "mode=evidence\n");
});

test("invalid evidence records its failure and exits non-zero", async (t) => {
  const cases: Array<{
    mutate: (reports: ReturnType<typeof releaseReports>) => void;
    name: string;
    pattern: RegExp;
  }> = [
    {
      name: "reports naming two commits",
      pattern: /do not name one commit/,
      mutate: (reports) => {
        reports[0] = { ...reports[0]!, commit: "c".repeat(40) };
      },
    },
    {
      name: "a failed report aggregate",
      pattern: /aggregate is invalid/,
      mutate: (reports) => {
        reports[0] = {
          ...reports[0]!,
          outcome: { status: "failed", exitCode: 1, signal: null },
        };
      },
    },
  ];
  for (const item of cases)
    await t.test(item.name, async (t) => {
      const root = await temporaryRoot(t);
      const reports = releaseReports();
      item.mutate(reports);
      await assert.rejects(
        runReleaseEvidence({
          env: evidenceEnvironment(path.join(root, "github-output")),
          repositoryRoot: root,
          execute: gitExecutor(),
          createGithub: () => githubFixture(releaseRun()),
          readReports: async () => reports,
          discoverNodeFiles: async () => nodeInventory(),
          discoverBrowserFiles: async () => browserInventory(),
        }),
        item.pattern,
      );
      const record = JSON.parse(
        await fs.readFile(
          path.join(root, ".context/release-evidence/record.json"),
          "utf8",
        ),
      ) as { mode: string; outcome: string };
      assert.equal(record.mode, "evidence");
      assert.equal(record.outcome, "invalid");
    });
});

test("absent CI evidence stops release preparation with recovery instructions", async (t) => {
  const run = releaseRun();
  const providers = {
    "unavailable candidate listing": {
      ...githubFixture(run),
      listPulls: async () => ({
        outcome: "absent" as const,
        reason: "CI listing unavailable",
      }),
    },
    "no eligible run": {
      ...githubFixture(run),
      listRuns: async () => ({ outcome: "applicable" as const, value: [] }),
    },
    "missing artifacts": {
      ...githubFixture(run),
      listArtifacts: async () => ({
        outcome: "applicable" as const,
        value: [],
      }),
    },
    "unrelated tree": {
      ...githubFixture(run),
      readCommitTree: async () => ({
        outcome: "applicable" as const,
        value: "d".repeat(40),
      }),
    },
  };
  for (const [name, github] of Object.entries(providers))
    await t.test(name, async (t) => {
      const root = await temporaryRoot(t);
      const reports = releaseReports(
        name === "unrelated tree" ? "c".repeat(40) : TAG_COMMIT,
      );
      await assert.rejects(
        runReleaseEvidence({
          env: evidenceEnvironment(path.join(root, "github-output")),
          repositoryRoot: root,
          execute: gitExecutor(),
          createGithub: () => github,
          readReports: async () => reports,
          discoverNodeFiles: async () => nodeInventory(reports),
          discoverBrowserFiles: async () => browserInventory(reports),
        }),
        new RegExp(
          `Re-run CI on release commit ${TAG_COMMIT}\\. Retry the release after CI passes\\.`,
        ),
      );
      const record = JSON.parse(
        await fs.readFile(
          path.join(root, ".context/release-evidence/record.json"),
          "utf8",
        ),
      );
      assert.equal(record.outcome, "absent");
      assert.equal(record.taggedCommit, TAG_COMMIT);
    });
});
