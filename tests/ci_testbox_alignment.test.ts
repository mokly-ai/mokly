import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const CI_WORKFLOW = ".github/workflows/ci.yml";
const TESTBOX_WORKFLOW = ".github/workflows/blacksmith-testbox.yml";
/** The only accepted Rust setup command: rustup reads `rust-toolchain.toml`. */
const TOOLCHAIN_INSTALL = "rustup toolchain install";
/** The action that restores and saves Cargo's dependency builds. */
const RUST_CACHE_ACTION = "Swatinem/rust-cache@";
/** The CI commands of the suites that the remote gate runs on Testboxes. */
const REMOTE_GATE_SUITES: Readonly<Record<string, RegExp>> = {
  repository: /\bcargo xtask check --suite repository\b/u,
  viewer: /\bcargo xtask check --suite viewer\b/u,
  browser: /\bcargo xtask check --suite browser\b/u,
  "static-delivery": /\bnpm run test:delivery:prepared\b/u,
};
/** Suites whose CI jobs share the Rust build cache that Testboxes restore. */
const SHARED_CACHE_SUITES = ["viewer", "browser", "static-delivery"];
/** Variables that change Rust builds; the cache key hashes these prefixes. */
const RUST_BUILD_VARIABLE = /^(?:CARGO|CC|CFLAGS|CXX|CMAKE|RUST)/u;

interface WorkflowStep {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly "runs-on"?: unknown;
  readonly steps?: readonly WorkflowStep[];
}

interface Workflow {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly jobs?: Readonly<Record<string, WorkflowJob>>;
}

test("Testboxes run on the runner of the CI suite jobs", async () => {
  const ci = await readWorkflow(CI_WORKFLOW);
  const runners = new Set(
    Object.keys(REMOTE_GATE_SUITES).map(
      (suite) => suiteJob(ci, suite)["runs-on"],
    ),
  );
  assert.equal(
    runners.size,
    1,
    "the CI suite jobs must share one runner, so that one Testbox job matches all of them",
  );
  assert.equal(
    testboxJob(await readWorkflow(TESTBOX_WORKFLOW))["runs-on"],
    [...runners][0],
  );
});

test("Testboxes build Rust with the CI workflow environment", async () => {
  const ci = await readWorkflow(CI_WORKFLOW);
  assert.ok(
    Object.keys(ci.env ?? {}).length > 0,
    "ci.yml must set its build environment at workflow level",
  );
  assert.deepEqual((await readWorkflow(TESTBOX_WORKFLOW)).env, ci.env);
});

test("CI suite jobs and Testboxes set Rust build variables only in the workflow env", async () => {
  const ci = await readWorkflow(CI_WORKFLOW);
  const owners = [
    ...Object.keys(REMOTE_GATE_SUITES).map(
      (suite) => [`the CI ${suite} job`, suiteJob(ci, suite)] as const,
    ),
    [
      "the Testbox job",
      testboxJob(await readWorkflow(TESTBOX_WORKFLOW)),
    ] as const,
  ];
  for (const [owner, job] of owners)
    for (const env of [job.env, ...(job.steps ?? []).map((step) => step.env)])
      for (const name of Object.keys(env ?? {}))
        assert.doesNotMatch(
          name,
          RUST_BUILD_VARIABLE,
          `${owner} must set ${name} in the workflow env, which the Testbox copies`,
        );
});

test("Testboxes restore the CI suite cache after the toolchain and never save it", async () => {
  const ci = await readWorkflow(CI_WORKFLOW);
  const [expected, ...others] = SHARED_CACHE_SUITES.map((suite) =>
    rustCache(suiteJob(ci, suite).steps ?? [], `the CI ${suite} job`),
  );
  assert.ok(expected, "CI must restore a shared suite cache");
  for (const other of others)
    assert.deepEqual(
      cacheIdentity(other),
      cacheIdentity(expected),
      "the CI viewer, browser, and static-delivery jobs must share one cache",
    );

  const steps = testboxJob(await readWorkflow(TESTBOX_WORKFLOW)).steps ?? [];
  const cache = rustCache(steps, "the Testbox job");
  const setup = steps.findIndex((step) => step.run === TOOLCHAIN_INSTALL);
  assert.equal(
    steps[setup + 1],
    cache,
    "the Testbox job must restore the Rust build cache right after the toolchain",
  );
  assert.equal(
    cache.with?.["save-if"],
    false,
    "Testboxes run unreviewed local trees, so they must never save a cache",
  );
  assert.deepEqual(cacheIdentity(cache), cacheIdentity(expected));
});

/** The action and options that select a cache entry and its paths. */
function cacheIdentity(step: WorkflowStep): unknown {
  const { "save-if": _saveIf, ...options } = step.with ?? {};
  return { uses: step.uses, options };
}

function rustCache(
  steps: readonly WorkflowStep[],
  owner: string,
): WorkflowStep {
  const caches = steps.filter(
    (step) => step.uses?.startsWith(RUST_CACHE_ACTION) ?? false,
  );
  assert.equal(caches.length, 1, `${owner} must restore one Rust cache`);
  return caches[0]!;
}

function suiteJob(workflow: Workflow, suite: string): WorkflowJob {
  const command = REMOTE_GATE_SUITES[suite]!;
  const jobs = Object.values(workflow.jobs ?? {}).filter((job) =>
    (job.steps ?? []).some((step) => command.test(step.run ?? "")),
  );
  assert.equal(jobs.length, 1, `one CI job must run the ${suite} suite`);
  return jobs[0]!;
}

function testboxJob(workflow: Workflow): WorkflowJob {
  const jobs = Object.values(workflow.jobs ?? {});
  assert.equal(jobs.length, 1, "the Testbox workflow must have one job");
  return jobs[0]!;
}

async function readWorkflow(file: string): Promise<Workflow> {
  return parse(
    await fs.readFile(path.join(repositoryRoot, file), "utf8"),
  ) as Workflow;
}
