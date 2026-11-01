import assert from "node:assert/strict";
import test from "node:test";

import { requireUnpublishedRelease } from "../scripts/release/fresh.mjs";
import { selectArtifactSource } from "../scripts/release/retry.mjs";
import { releasePackages } from "../scripts/release/targets.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const tagCommit = "a".repeat(40);
const input = {
  eventName: "push",
  runId: "42",
  repository: "mokly-ai/mokly",
  version: "0.15.0",
};
const run = {
  event: "push",
  head_branch: "main",
  head_sha: "b".repeat(40),
  workflow_id: 123,
  path: ".github/workflows/release.yml@main",
  head_repository: { full_name: input.repository },
};
const artifact = { name: "mokly-release-0.15.0", expired: false };
const client = (artifacts = [artifact]) => ({
  run: async () => run,
  artifacts: async () => artifacts,
});

test("first runs build only absent artifacts; reruns and manual retries reuse the first checked set", async () => {
  assert.equal(await selectArtifactSource(input, client([])), undefined);
  assert.deepEqual(await selectArtifactSource(input, client()), {
    runId: "42",
    name: artifact.name,
  });
  assert.deepEqual(
    await selectArtifactSource(
      {
        ...input,
        eventName: "workflow_dispatch",
        runId: "99",
        manualRunId: "42",
      },
      client(),
    ),
    { runId: "42", name: artifact.name },
  );
  await assert.rejects(
    selectArtifactSource(
      { ...input, eventName: "workflow_dispatch", manualRunId: "42" },
      client([]),
    ),
    /no checked/,
  );
  await assert.rejects(
    selectArtifactSource(
      { ...input, eventName: "workflow_dispatch" },
      client(),
    ),
    /artifact_run_id/,
  );
  for (const artifacts of [
    [{ ...artifact, expired: true }],
    [artifact, artifact],
  ])
    await assert.rejects(selectArtifactSource(input, client(artifacts)));
});

test("automatic release selection only lists the current run even when its head is newer than the tag", async () => {
  assert.notEqual(run.head_sha, tagCommit);
  const calls: string[] = [];
  assert.deepEqual(
    await selectArtifactSource(input, {
      run: async () =>
        assert.fail("automatic selection must not read run metadata"),
      artifacts: async (id) => {
        calls.push(id);
        return [artifact];
      },
    }),
    { runId: input.runId, name: artifact.name },
  );
  assert.deepEqual(calls, [input.runId]);
});

test("manual retries use workflow identity and accept a suffixed path and a head newer than the tag", async () => {
  assert.notEqual(run.head_sha, tagCommit);
  const calls: string[] = [];
  assert.deepEqual(
    await selectArtifactSource(
      {
        ...input,
        eventName: "workflow_dispatch",
        runId: "99",
        manualRunId: "42",
      },
      {
        run: async (id) => {
          calls.push(`run ${id}`);
          return run;
        },
        artifacts: async (id) => {
          calls.push(`artifacts ${id}`);
          return [artifact];
        },
      },
    ),
    { runId: "42", name: artifact.name },
  );
  assert.deepEqual(calls.sort(), ["artifacts 42", "run 42", "run 99"]);
});

test("manual retries reject other repositories, branches, events and workflow ids", async () => {
  for (const changed of [
    { event: "pull_request" },
    { event: "workflow_dispatch" },
    { head_branch: "other" },
    { workflow_id: 456 },
    { workflow_id: 0 },
    { head_repository: { full_name: "fork/mokly" } },
  ])
    await assert.rejects(
      selectArtifactSource(
        {
          ...input,
          eventName: "workflow_dispatch",
          runId: "99",
          manualRunId: "42",
        },
        {
          ...client(),
          run: async (id) => (id === "99" ? run : { ...run, ...changed }),
        },
      ),
      /original main push/,
    );
  await assert.rejects(
    selectArtifactSource(input, {
      ...client(),
      artifacts: async () => {
        throw new Error("GitHub unavailable");
      },
    }),
    /GitHub unavailable/,
  );
});

test("first-run builds refuse any partially published version and fail closed on registry errors", async () => {
  const calls: string[][] = [];
  await requireUnpublishedRelease(repositoryRoot, async (file, args) => {
    calls.push([file, ...args]);
    return { code: 1, signal: null, stdout: "", stderr: "npm error code E404" };
  });
  assert.equal(calls.length, 8);
  assert.deepEqual(
    calls.map((args) => args[2]!.slice(0, args[2]!.lastIndexOf("@"))),
    releasePackages().map(({ name }) => name),
  );
  for (const result of [
    { code: 0, signal: null, stdout: "{}", stderr: "" },
    { code: 1, signal: null, stdout: "", stderr: "ETIMEDOUT" },
  ])
    await assert.rejects(
      requireUnpublishedRelease(repositoryRoot, async () => result),
      /already published|lookup failed/,
    );
});
