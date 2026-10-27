import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import {
  RUST_AUDIT_TOOL_DIRECTORY,
  RUST_AUDIT_TOOL_LOCK,
} from "../scripts/verification/rust-audit-tool.mjs";

import { repositoryRoot } from "./helpers/fixture.js";

const CI_WORKFLOW = ".github/workflows/ci.yml";
/** The only accepted Rust setup command: rustup reads `rust-toolchain.toml`. */
const TOOLCHAIN_INSTALL = "rustup toolchain install";
/** The action that restores and saves Cargo's dependency builds. */
const RUST_CACHE_ACTION = "Swatinem/rust-cache@";
/** Only runs on `main` may write what CI and pull requests restore. */
const MAIN_ONLY = "${{ github.ref == 'refs/heads/main' }}";
/** The installer whose pinned release is part of the audit tool identity. */
const RUST_AUDIT_INSTALLER = "scripts/verification/rust-audit-tool.mjs";
/** Settings that build CI Rust without debug info or incremental artifacts. */
const BUILD_SETTINGS = [
  "CARGO_INCREMENTAL",
  "CARGO_PROFILE_DEV_DEBUG",
  "CARGO_PROFILE_TEST_DEBUG",
];
/** Release automation builds every published binary without a cache. */
const UNCACHED_AUTOMATION = [
  ".github/workflows/release.yml",
  ".github/workflows/release-check.yml",
  ".github/workflows/release-prepare.yml",
  ".github/workflows/native-bootstrap.yml",
  ".github/actions/publish/action.yml",
];
/** Any action or compiler wrapper that reuses build or compiler output. */
const BUILD_CACHE =
  /\b(?:actions\/cache|Swatinem\/rust-cache|sccache|RUSTC_WRAPPER)\b/u;

interface WorkflowStep {
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  readonly steps?: readonly WorkflowStep[];
}

interface Workflow {
  readonly env?: Readonly<Record<string, unknown>>;
  readonly jobs?: Readonly<Record<string, WorkflowJob>>;
  readonly runs?: { readonly steps?: readonly WorkflowStep[] };
}

test("every CI Rust job restores the build cache right after the toolchain", async () => {
  const workflow = await readWorkflow(CI_WORKFLOW);
  let rustJobs = 0;
  for (const [name, job] of Object.entries(workflow.jobs ?? {})) {
    const steps = job.steps ?? [];
    const setup = steps.findIndex((step) => step.run === TOOLCHAIN_INSTALL);
    const caches = steps.filter(isRustCache);
    if (setup < 0) {
      assert.deepEqual(caches, [], `${name} has no Rust to cache`);
      continue;
    }
    rustJobs += 1;
    assert.equal(caches.length, 1, `${name} must restore one Rust cache`);
    assert.ok(
      isRustCache(steps[setup + 1]),
      `${name} must restore the Rust build cache right after the toolchain`,
    );
  }
  assert.ok(rustJobs > 0, "CI must have Rust jobs");
});

test("Rust build caches save only from main", async () => {
  let caches = 0;
  for (const file of await automationFiles()) {
    for (const step of stepsOf(await readWorkflow(file))) {
      if (!isRustCache(step)) continue;
      caches += 1;
      assert.equal(
        step.with?.["save-if"],
        MAIN_ONLY,
        `${file} must save its Rust build cache only from main`,
      );
    }
  }
  assert.ok(caches > 0, "CI must restore Rust build caches");
});

test("release automation builds Rust without a build cache", async () => {
  for (const file of UNCACHED_AUTOMATION)
    assert.doesNotMatch(
      await readText(file),
      BUILD_CACHE,
      `${file} must build without a build cache`,
    );
});

test("the Rust audit tool cache follows the tool identity", async () => {
  const steps = stepsOf(await readWorkflow(CI_WORKFLOW)).filter(
    (step) =>
      isRustCache(step) &&
      String(step.with?.["cache-directories"] ?? "")
        .split(/\s+/u)
        .includes(RUST_AUDIT_TOOL_DIRECTORY),
  );
  assert.equal(steps.length, 1, "one CI job must cache the Rust audit tool");
  const options = steps[0]?.with ?? {};
  assert.equal(
    options["shared-key"],
    undefined,
    "the cache action ignores its key input when shared-key is set",
  );
  const key = String(options.key ?? "");
  assert.match(key, /\$\{\{ hashFiles\(/u);
  for (const input of [RUST_AUDIT_TOOL_LOCK, RUST_AUDIT_INSTALLER]) {
    assert.ok(existsSync(path.join(repositoryRoot, input)), `${input} exists`);
    assert.ok(key.includes(`'${input}'`), `the cache key must hash ${input}`);
  }
});

test("CI builds Rust without debug info or incremental artifacts", async () => {
  const { env } = await readWorkflow(CI_WORKFLOW);
  for (const name of BUILD_SETTINGS)
    assert.equal(String(env?.[name]), "0", `ci.yml must set ${name} to 0`);
});

function isRustCache(step: WorkflowStep | undefined): boolean {
  return step?.uses?.startsWith(RUST_CACHE_ACTION) ?? false;
}

function stepsOf(workflow: Workflow): WorkflowStep[] {
  return [
    ...Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []),
    ...(workflow.runs?.steps ?? []),
  ];
}

async function automationFiles(): Promise<string[]> {
  const workflows = (
    await fs.readdir(path.join(repositoryRoot, ".github/workflows"))
  )
    .filter((name) => /\.ya?ml$/u.test(name))
    .map((name) => `.github/workflows/${name}`);
  const actionRoot = path.join(repositoryRoot, ".github/actions");
  const actions = (await fs.readdir(actionRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `.github/actions/${entry.name}/action.yml`)
    .filter((file) => existsSync(path.join(repositoryRoot, file)));
  return [...workflows, ...actions].sort();
}

async function readWorkflow(file: string): Promise<Workflow> {
  return parse(await readText(file)) as Workflow;
}

async function readText(file: string): Promise<string> {
  return await fs.readFile(path.join(repositoryRoot, file), "utf8");
}
