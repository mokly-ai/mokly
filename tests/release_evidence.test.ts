import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runReleaseEvidence } from "../scripts/release/evidence.mjs";
import {
  classifyEvidence,
  resolveVerificationMode,
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
  unitInventory,
  verificationArtifacts,
} from "./helpers/release_evidence.js";

test("release verification mode is evidence by default and complete only by dispatch", () => {
  assert.equal(
    resolveVerificationMode({ eventName: "push", manualVerification: "" }),
    "evidence",
  );
  assert.equal(
    resolveVerificationMode({
      eventName: "workflow_dispatch",
      manualVerification: "",
    }),
    "evidence",
  );
  assert.equal(
    resolveVerificationMode({
      eventName: "workflow_dispatch",
      manualVerification: "complete",
    }),
    "complete",
  );
  assert.throws(
    () =>
      resolveVerificationMode({
        eventName: "workflow_dispatch",
        manualVerification: "skip",
      }),
    /unsupported release verification mode/,
  );
  assert.throws(
    () =>
      resolveVerificationMode({
        eventName: "schedule",
        manualVerification: "",
      }),
    /unsupported release event/,
  );
});

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
    liveUnitFiles: unitInventory(reports),
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
      { ...base, liveUnitFiles: ["tests/missing.test.ts"] },
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
    discoverUnitFiles: async () => unitInventory(reports),
  });
  assert.deepEqual(record, {
    mode: "evidence",
    outcome: "applicable",
    taggedCommit: TAG_COMMIT,
    taggedTree: TAG_TREE,
    selectedRunId: run.id,
    selectedRunUrl: run.html_url,
    evidenceCommit: TAG_COMMIT,
    reportCount: 16,
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

test("invalid evidence records complete output and exits non-zero", async (t) => {
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
          discoverUnitFiles: async () => unitInventory(),
        }),
        item.pattern,
      );
      const record = JSON.parse(
        await fs.readFile(
          path.join(root, ".context/release-evidence/record.json"),
          "utf8",
        ),
      ) as { mode: string; outcome: string };
      assert.equal(record.mode, "complete");
      assert.equal(record.outcome, "invalid");
    });
});

test("complete mode performs no GitHub requests", async (t) => {
  const root = await temporaryRoot(t);
  let created = false;
  const record = await runReleaseEvidence({
    env: {
      RELEASE_VERIFICATION: "complete",
      GITHUB_OUTPUT: path.join(root, "github-output"),
    },
    repositoryRoot: root,
    execute: gitExecutor(),
    createGithub: () => {
      created = true;
      throw new Error("unexpected GitHub client");
    },
  });
  assert.equal(created, false);
  assert.equal(record.mode, "complete");
  assert.equal(record.outcome, "complete");
});

function githubFixture(run: ReturnType<typeof releaseRun>) {
  return {
    listPulls: async () => ({ outcome: "applicable" as const, value: [] }),
    listRuns: async (event: string) => ({
      outcome: "applicable" as const,
      value: event === "push" ? [run] : [],
    }),
    listJobs: async () => ({
      outcome: "applicable" as const,
      value: requiredJobs(),
    }),
    listArtifacts: async () => ({
      outcome: "applicable" as const,
      value: verificationArtifacts(),
    }),
    downloadArtifact: async () => ({ outcome: "applicable" as const }),
    readCommitTree: async () => ({
      outcome: "applicable" as const,
      value: TAG_TREE,
    }),
  };
}

function evidenceEnvironment(output: string) {
  return {
    RELEASE_VERIFICATION: "evidence",
    GITHUB_TOKEN: "token",
    GITHUB_REPOSITORY: "mokly-ai/mokly",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_OUTPUT: output,
  };
}

async function temporaryRoot(t: test.TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
