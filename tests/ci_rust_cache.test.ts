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
/** The action that restores and saves Cargo's dependency builds. */
const RUST_CACHE_ACTION = "Swatinem/rust-cache@";
/**
 * Only runs on `main` may write what CI and pull requests restore. A job may
 * narrow the rule with more `&&` terms, as a restore-only matrix row does,
 * but it may not widen it with an `||` outside parentheses.
 */
const MAIN_ONLY = "${{ github.ref == 'refs/heads/main' }}";
/** The start of a narrowed save condition: `main` and more terms. */
const MAIN_AND = "${{ github.ref == 'refs/heads/main' && ";
/** Testboxes run unreviewed local trees on `main`, so they never save. */
const RESTORE_ONLY_WORKFLOWS = [".github/workflows/blacksmith-testbox.yml"];
/** The installer whose pinned release is part of the audit tool identity. */
const RUST_AUDIT_INSTALLER = "scripts/verification/rust-audit-tool.mjs";
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

test("Rust build caches save only from main, and Testboxes never save", async () => {
  let caches = 0;
  for (const file of await automationFiles()) {
    for (const step of stepsOf(await readWorkflow(file))) {
      if (!isRustCache(step)) continue;
      caches += 1;
      if (RESTORE_ONLY_WORKFLOWS.includes(file))
        assert.equal(
          step.with?.["save-if"],
          false,
          `${file} must never save its Rust build cache`,
        );
      // A step that restores the entry of another job never saves.
      else if (step.with?.["save-if"] !== false)
        assert.ok(
          savesOnlyFromMain(step.with?.["save-if"]),
          `${file} must save its Rust build cache only from main, not ${String(step.with?.["save-if"])}`,
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

/**
 * The condition is `main` alone, or `main` and a condition with no `||`
 * outside parentheses and quoted strings, so every saving run is a run on
 * `main`.
 */
function savesOnlyFromMain(condition: unknown): boolean {
  if (condition === MAIN_ONLY) return true;
  if (
    typeof condition !== "string" ||
    !condition.startsWith(MAIN_AND) ||
    !condition.endsWith(" }}")
  )
    return false;
  let depth = 0;
  let quoted = false;
  const rest = condition.slice(MAIN_AND.length, -" }}".length);
  for (const [index, character] of [...rest].entries()) {
    // A quoted string is text; `''` inside it closes and reopens it.
    if (character === "'") quoted = !quoted;
    if (quoted) continue;
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (depth < 0) return false;
    if (depth === 0 && rest.startsWith("||", index)) return false;
  }
  return depth === 0 && !quoted;
}

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
