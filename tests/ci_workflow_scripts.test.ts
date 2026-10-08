import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import { parse } from "yaml";

import { TESTED_NODE_VERSIONS } from "../dist/cli/bootstrap.js";
import { RELEASE_VERIFICATION_RUNTIMES } from "../scripts/release/evidence_contract.mjs";

import { repositoryRoot } from "./helpers/fixture.js";
import { readTestboxWorkflow } from "./helpers/testbox_workflow.js";

const execute = promisify(execFile);
const PROFILE_SELECTOR = "Select Node verification profile";
const RELEASE_GATE = "Run complete verification";
const SELECTOR_OUTPUTS = ["node-matrix", "verification-runtimes"];

interface CiStep {
  readonly id?: string;
  readonly name?: string;
  readonly run?: string;
}

interface CiJob {
  readonly outputs?: Readonly<Record<string, string>>;
  readonly steps?: readonly CiStep[];
}

interface CiWorkflow {
  readonly jobs?: Readonly<Record<string, CiJob>>;
}

test("the Node profile selector adds release runtimes only for release pull requests", async (context) => {
  const { job, step } = await workflowStep("ci.yml", PROFILE_SELECTOR);
  const { id, run } = step;
  assert.ok(id, `"${PROFILE_SELECTOR}" needs an id to publish its outputs`);
  assert.ok(run, `"${PROFILE_SELECTOR}" must run a shell script`);
  for (const output of SELECTOR_OUTPUTS)
    assert.equal(
      job.outputs?.[output],
      `\${{ steps.${id}.outputs.${output} }}`,
      `the selector's job must expose its ${output} output`,
    );
  const [minimumTestedNode] = TESTED_NODE_VERSIONS;
  const [ordinaryRuntime] = RELEASE_VERIFICATION_RUNTIMES;
  for (const profile of [
    { release: false, nodes: [minimumTestedNode], runtimes: [ordinaryRuntime] },
    {
      release: true,
      nodes: RELEASE_VERIFICATION_RUNTIMES.map(nodeLabel),
      runtimes: RELEASE_VERIFICATION_RUNTIMES,
    },
  ]) {
    await context.test(profile.release ? "release" : "ordinary", async () => {
      const output = await runSelector(run, profile.release);
      assert.equal(output["node-matrix"], JSON.stringify(profile.nodes));
      assert.equal(output["verification-runtimes"], profile.runtimes.join(","));
    });
  }
});

test("the Testbox lockfile stamp holds only the lockfile digest and a newline", async (context) => {
  const script = await testboxScript("Stamp installed lockfile");
  if (process.platform !== "linux") return;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-testbox-stamp-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const lockfile = Buffer.from('{"lockfileVersion":3,"packages":{}}\n');
  await fs.writeFile(path.join(root, "package-lock.json"), lockfile);
  const output = await runBash(script, root, {
    PATH: process.env.PATH,
    HOME: root,
  });
  assert.equal(output.stdout, "");
  assert.equal(output.stderr, "");
  assert.equal(
    await fs.readFile(
      path.join(root, ".mokly-testbox/package-lock.sha256"),
      "utf8",
    ),
    `${createHash("sha256").update(lockfile).digest("hex")}\n`,
  );
});

test("Testbox sessions receive the job PATH and Playwright channel only", async (context) => {
  const original = await testboxScript(
    "Expose job environment to Testbox sessions",
  );
  assert.ok(
    original.includes("/etc/environment"),
    "the step must write /etc/environment, which this test redirects",
  );
  if (process.platform !== "linux") return;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-testbox-env-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, "environment");
  await fs.writeFile(
    file,
    "LANG=en_US.UTF-8\nPATH=old\nPLAYWRIGHT_CHANNEL=old\nKEEP=value\nPATH=duplicate\n",
  );
  const script = original.replaceAll(
    "/etc/environment",
    '"$MOKLY_TESTBOX_ENVIRONMENT"',
  );
  const output = await runBash(`sudo() { "$@"; }\n${script}`, root, {
    PATH: process.env.PATH,
    PLAYWRIGHT_CHANNEL: "chromium",
    MOKLY_TESTBOX_ENVIRONMENT: file,
  });
  assert.equal(output.stdout, "");
  assert.equal(output.stderr, "");
  assert.equal(
    await fs.readFile(file, "utf8"),
    `LANG=en_US.UTF-8\nKEEP=value\nPATH=${process.env.PATH}\nPLAYWRIGHT_CHANNEL=chromium\n`,
  );
});

test("the release complete gate verifies the checked-out tag commit", async (context) => {
  const { run } = (await workflowStep("release.yml", RELEASE_GATE)).step;
  assert.ok(run, `"${RELEASE_GATE}" must run a shell script`);
  if (process.platform === "win32") return;
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-release-gate-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execute("git", args, { cwd: root });
  await git("init", "-q");
  await git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "-q",
    "--allow-empty",
    "-m",
    "chore: release",
  );
  const tagCommit = (await git("rev-parse", "HEAD")).stdout.trim();
  const bin = path.join(root, "bin");
  await fs.mkdir(bin);
  await fs.writeFile(
    path.join(bin, "cargo"),
    '#!/bin/sh\nprintf %s "$GITHUB_SHA" > "$GATE_COMMIT"\n',
    { mode: 0o755 },
  );
  const record = path.join(root, "gate-commit");
  await runBash(run, root, {
    PATH: `${bin}${path.delimiter}${process.env.PATH ?? ""}`,
    HOME: root,
    GITHUB_SHA: "f".repeat(40),
    GATE_COMMIT: record,
  });
  assert.equal(await fs.readFile(record, "utf8"), tagCommit);
});

async function workflowStep(
  file: string,
  name: string,
): Promise<{ job: CiJob; step: CiStep }> {
  const workflow = parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows", file),
      "utf8",
    ),
  ) as CiWorkflow;
  const [match, ...others] = Object.values(workflow.jobs ?? {}).flatMap((job) =>
    (job.steps ?? [])
      .filter((step) => step.name === name)
      .map((step) => ({ job, step })),
  );
  assert.ok(match, `${file} must have a "${name}" step`);
  assert.equal(others.length, 0, `${file} must have one "${name}" step`);
  return match;
}

async function testboxScript(name: string): Promise<string> {
  const { workflow } = await readTestboxWorkflow();
  const [step, ...others] = Object.values(workflow.jobs).flatMap((job) =>
    job.steps.filter((candidate) => candidate.name === name),
  );
  assert.ok(step, `blacksmith-testbox.yml must have a "${name}" step`);
  assert.equal(
    others.length,
    0,
    `blacksmith-testbox.yml must have one "${name}" step`,
  );
  assert.ok(step.run, `"${name}" must run a shell script`);
  return step.run;
}

function nodeLabel(runtime: string): string {
  return runtime.replace(/^node-/u, "");
}

async function runSelector(
  script: string,
  release: boolean,
): Promise<Readonly<Record<string, string>>> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-ci-profile-"));
  const outputPath = path.join(root, "output");
  try {
    await runBash(script, repositoryRoot, {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
      RELEASE_PULL_REQUEST: String(release),
    });
    const output = await fs.readFile(outputPath, "utf8");
    return Object.fromEntries(
      output
        .trim()
        .split("\n")
        .map((line) => {
          const separator = line.indexOf("=");
          return [line.slice(0, separator), line.slice(separator + 1)];
        }),
    );
  } finally {
    await fs.rm(root, { force: true, recursive: true });
  }
}

async function runBash(
  script: string,
  cwd: string,
  env: NodeJS.ProcessEnv,
): Promise<{ stdout: string; stderr: string }> {
  return await execute(
    "bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
    { cwd, env },
  );
}
