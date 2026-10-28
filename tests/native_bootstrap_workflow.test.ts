import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

const REVIEWED_COMMIT = "c84be6c400ae4c75ab7b51b1250c39d010e166ca";
/** Setup steps that stay identical to the release workflow's native build. */
const SHARED_STEPS = [
  "Set up Node.js",
  "Set up npm",
  "Set up Rust",
  "Install target",
  "Install dependencies",
  "Set up Linux release tools",
];

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

async function workflow(name: string) {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows", name),
    "utf8",
  );
  const document = record(parse(source));
  return { source, document, jobs: record(document.jobs) };
}

function named(steps: readonly UnknownRecord[], name: string) {
  const [step, ...others] = steps.filter((step) => step.name === name);
  assert.ok(step, `missing "${name}" step`);
  assert.equal(others.length, 0, `duplicate "${name}" step`);
  return step;
}

function matrixRows(job: UnknownRecord) {
  return list(record(record(job.strategy).matrix).include).map(
    ({ target, triple, runner }) => ({ target, triple, runner }),
  );
}

function actions(steps: readonly UnknownRecord[]) {
  const uses = steps.flatMap((step) =>
    typeof step.uses === "string" ? [step.uses] : [],
  );
  return [...new Set(uses)].sort();
}

function checkouts(steps: readonly UnknownRecord[]) {
  return steps.filter((step) => String(step.uses).includes("/checkout@"));
}

/** The shared setup step names in the order that a job runs them. */
function sharedOrder(steps: readonly UnknownRecord[]) {
  const position = (name: string) => steps.indexOf(named(steps, name));
  return [...SHARED_STEPS].sort(
    (left, right) => position(left) - position(right),
  );
}

test("native bootstrap is a read-only manual dispatch of one reviewed commit", async () => {
  const { source, document, jobs } = await workflow("native-bootstrap.yml");
  const triggers = record(document.on);
  assert.deepEqual(Object.keys(triggers), ["workflow_dispatch"]);
  const inputs = record(record(triggers.workflow_dispatch).inputs);
  assert.deepEqual(Object.keys(inputs), ["commit"]);
  assert.equal(record(inputs.commit).required, true);
  assert.equal(record(inputs.commit).type, "string");
  assert.deepEqual(document.permissions, { contents: "read" });
  assert.equal(record(document.concurrency)["cancel-in-progress"], false);
  for (const [name, value] of Object.entries(jobs)) {
    const job = record(value);
    assert.equal(job.permissions, undefined, `${name} widens permissions`);
    assert.equal(job.environment, undefined, `${name} uses an environment`);
    assert.equal(typeof job["timeout-minutes"], "number", `${name} timeout`);
    assert.equal(record(record(job.defaults).run).shell, "bash", name);
  }
  assert.doesNotMatch(
    source,
    /secrets\.|id-token|environment:|NODE_AUTH_TOKEN|registry-url/,
  );
  const commands = Object.values(jobs)
    .flatMap((job) => list(record(job).steps))
    .map((step) => String(step.run ?? ""))
    .join("\n");
  assert.doesNotMatch(
    commands,
    /\bnpm (?:publish|unpublish|dist-tag|deprecate|owner|access|trust)\b/,
  );
});

test("native bootstrap builds the release matrix with the release setup", async () => {
  const build = record(
    (await workflow("native-bootstrap.yml")).jobs["build-native"],
  );
  const release = record((await workflow("release.yml")).jobs["build-native"]);
  assert.deepEqual(matrixRows(build), matrixRows(release));
  assert.equal(record(build.strategy)["fail-fast"], false);
  assert.equal(build["runs-on"], release["runs-on"]);
  assert.equal(build["timeout-minutes"], release["timeout-minutes"]);

  const steps = list(build.steps);
  const releaseSteps = list(release.steps);
  assert.deepEqual(actions(steps), actions(releaseSteps));
  for (const name of SHARED_STEPS)
    assert.deepEqual(named(steps, name), named(releaseSteps, name), name);
  assert.deepEqual(sharedOrder(steps), sharedOrder(releaseSteps));
  assert.deepEqual(
    checkouts(steps).map((step) => [step.if, step.uses]),
    checkouts(releaseSteps).map((step) => [step.if, step.uses]),
  );
  for (const checkout of checkouts(steps))
    assert.deepEqual(checkout.with, {
      "fetch-depth": 1,
      ref: "${{ inputs.commit }}",
      "persist-credentials": false,
    });
});

test("each native bootstrap job uploads its archive with the source reports", async () => {
  const build = record(
    (await workflow("native-bootstrap.yml")).jobs["build-native"],
  );
  assert.deepEqual(build.env, {
    COMMIT: "${{ inputs.commit }}",
    RELEASE_TARGET: "${{ matrix.target }}",
    RUST_TARGET: "${{ matrix.triple }}",
  });
  const steps = list(build.steps);
  const pack = steps.findIndex((step) =>
    String(step.run).startsWith("node scripts/release/bootstrap.mjs "),
  );
  assert.equal(
    steps[pack]?.run,
    'node scripts/release/bootstrap.mjs "$COMMIT" ".context/native-bootstrap/$RELEASE_TARGET" "@mokly/native-$RELEASE_TARGET"',
  );
  for (const name of SHARED_STEPS)
    assert.ok(steps.indexOf(named(steps, name)) < pack, `${name} runs first`);
  assert.equal(pack, steps.length - 2, "the upload follows the bootstrap");
  const upload = steps.at(-1);
  assert.match(String(upload?.uses), /^actions\/upload-artifact@/);
  assert.deepEqual(upload?.with, {
    name: "native-bootstrap-${{ matrix.target }}",
    path: ".context/native-bootstrap/${{ matrix.target }}/",
    "include-hidden-files": true,
    "if-no-files-found": "error",
    "retention-days": 30,
    overwrite: true,
  });
});

test("only a full lowercase commit SHA starts the native builds", async () => {
  const { jobs } = await workflow("native-bootstrap.yml");
  const [check, ...others] = Object.keys(jobs).filter(
    (name) => name !== "build-native",
  );
  assert.ok(check);
  assert.deepEqual(others, []);
  assert.deepEqual(record(jobs["build-native"]).needs, [check]);
  const validate = record(jobs[check]);
  assert.deepEqual(validate.env, { COMMIT: "${{ inputs.commit }}" });
  const [step, ...more] = list(validate.steps);
  assert.ok(typeof step?.run === "string");
  assert.deepEqual(more, []);
  if (process.platform === "win32") return;

  assert.deepEqual(validateCommit(step.run, REVIEWED_COMMIT), {
    accepted: true,
    output: "",
  });
  for (const commit of [
    "",
    "main",
    "refs/heads/main",
    REVIEWED_COMMIT.slice(0, 7),
    REVIEWED_COMMIT.slice(0, 39),
    `${REVIEWED_COMMIT}0`,
    `${REVIEWED_COMMIT.slice(0, 39)}g`,
    REVIEWED_COMMIT.toUpperCase(),
    ` ${REVIEWED_COMMIT}`,
    `${REVIEWED_COMMIT}\n`,
  ]) {
    const result = validateCommit(step.run, commit);
    assert.equal(result.accepted, false, JSON.stringify(commit));
    assert.match(result.output, /^::error::/u);
    if (commit !== "")
      assert.ok(!result.output.includes(commit), "the input is not echoed");
  }
});

/** Runs the check as GitHub's `bash` shell does, with only the input set. */
function validateCommit(script: string, commit: string) {
  const result = spawnSync(
    "bash",
    ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script],
    {
      cwd: os.tmpdir(),
      encoding: "utf8",
      env: { PATH: process.env.PATH, COMMIT: commit },
    },
  );
  assert.equal(result.error, undefined);
  assert.ok(result.status === 0 || result.status === 1, `${result.status}`);
  return {
    accepted: result.status === 0,
    output: result.stdout + result.stderr,
  };
}
