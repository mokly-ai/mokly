import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Script } from "node:vm";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

function record(value: unknown): Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null);
  return Object.fromEntries(Object.entries(value));
}

/**
 * The script of the tag job's only step. The xtask repository rules check
 * the job's structure, permissions, and dependents.
 */
async function tagScript(): Promise<string> {
  const jobs = record(
    record(
      parse(
        await fs.readFile(
          path.join(repositoryRoot, ".github/workflows/release.yml"),
          "utf8",
        ),
      ),
    ).jobs,
  );
  const steps = record(jobs["release-tags"]).steps;
  assert.ok(Array.isArray(steps));
  const script = record(record(steps[0]).with).script;
  assert.equal(typeof script, "string");
  return String(script);
}

async function runTagScript(
  options: {
    event?: string;
    viewerCommit?: string;
    failure?: Error;
    cliRef?: string;
  } = {},
) {
  const calls: { operation: string; ref: string; sha?: string }[] = [];
  const commit = "a".repeat(40);
  const missing = Object.assign(new Error("viewer tag is absent"), {
    status: 404,
  });
  const script = await tagScript();
  const run = async () => {
    await new Script(`(async () => { ${script} })()`).runInNewContext({
      process: { env: { PUBLISH_REF: options.cliRef ?? "v0.16.0" } },
      context: {
        repo: { owner: "mokly-ai", repo: "mokly" },
        eventName: options.event ?? "push",
      },
      github: {
        rest: {
          repos: {
            getCommit: async ({ ref }: { ref: string }) => {
              calls.push({ operation: "read", ref });
              if (ref === "tags/v0.16.0") return { data: { sha: commit } };
              if (options.viewerCommit)
                return { data: { sha: options.viewerCommit } };
              throw Object.assign(new Error("No commit found for SHA"), {
                status: 422,
              });
            },
          },
          git: {
            getRef: async ({ ref }: { ref: string }) => {
              calls.push({ operation: "lookup", ref });
              if (options.failure) throw options.failure;
              if (options.viewerCommit) return { data: { ref } };
              throw missing;
            },
            createRef: async ({ ref, sha }: { ref: string; sha: string }) => {
              calls.push({ operation: "create", ref, sha });
            },
          },
        },
      },
    });
  };
  return { run, calls, commit };
}

test("automatic releases create the matching viewer tag before builds", async () => {
  const fixture = await runTagScript();
  await fixture.run();
  assert.deepEqual(fixture.calls, [
    { operation: "read", ref: "tags/v0.16.0" },
    { operation: "lookup", ref: "tags/viewer-v0.16.0" },
    {
      operation: "create",
      ref: "refs/tags/viewer-v0.16.0",
      sha: fixture.commit,
    },
  ]);
});

test("tag reruns accept matching commits and never overwrite other tags", async () => {
  for (const event of ["push", "workflow_dispatch"]) {
    const fixture = await runTagScript({ event, viewerCommit: "a".repeat(40) });
    await fixture.run();
    assert.equal(fixture.calls.length, 3);
    const mismatch = await runTagScript({
      event,
      viewerCommit: "b".repeat(40),
    });
    await assert.rejects(mismatch.run(), /same commit/);
    assert.equal(mismatch.calls.length, 3);
  }
});

test("manual retries and transport failures cannot create tags", async () => {
  for (const options of [
    { event: "workflow_dispatch" },
    { failure: Object.assign(new Error("denied"), { status: 403 }) },
    { failure: new Error("network unavailable") },
  ]) {
    const fixture = await runTagScript(options);
    await assert.rejects(fixture.run());
    assert.equal(fixture.calls.length, 2);
  }
  const invalid = await runTagScript({ cliRef: "main" });
  await assert.rejects(invalid.run(), /immutable/);
  assert.deepEqual(invalid.calls, []);
});
