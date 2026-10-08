import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { TESTED_NODE_VERSIONS } from "../dist/cli/bootstrap.js";

import { repositoryRoot } from "./helpers/fixture.js";

const TESTBOX_WORKFLOW = ".github/workflows/blacksmith-testbox.yml";
const AUDIT_WORKFLOW = ".github/workflows/dependency-audit.yml";
const CI_WORKFLOW = ".github/workflows/ci.yml";
const CHECKOUT_ACTIONS = ["useblacksmith/checkout@", "actions/checkout@"];

interface WorkflowStep {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  readonly permissions?: unknown;
  readonly steps?: readonly WorkflowStep[];
}

interface Workflow {
  readonly permissions?: unknown;
  readonly jobs?: Readonly<Record<string, WorkflowJob>>;
  readonly on?: string | readonly string[] | Readonly<Record<string, unknown>>;
}

test("Testbox access is read-only and exposes no secrets or persisted credentials", async () => {
  const { workflow, source } = await readWorkflow(TESTBOX_WORKFLOW);
  assert.deepEqual(
    workflow.permissions,
    { contents: "read" },
    `${TESTBOX_WORKFLOW} must grant only contents: read`,
  );
  assert.doesNotMatch(
    source,
    /\bsecrets\s*(?:\.|\[)/u,
    `${TESTBOX_WORKFLOW} must not reference secrets`,
  );
  const jobs = Object.entries(workflow.jobs ?? {});
  assert.ok(jobs.length > 0, `${TESTBOX_WORKFLOW} must define jobs`);
  for (const [name, job] of jobs) {
    assert.equal(
      Object.hasOwn(job, "permissions"),
      false,
      `${TESTBOX_WORKFLOW} job ${name} must not override permissions`,
    );
    for (const step of job.steps ?? []) {
      if (!CHECKOUT_ACTIONS.some((action) => step.uses?.startsWith(action)))
        continue;
      assert.equal(
        step.with?.["persist-credentials"],
        false,
        `${TESTBOX_WORKFLOW} job ${name} checkout must set persist-credentials: false`,
      );
    }
  }
});

test("Dependency Audit installs no dependencies before auditing main", async () => {
  const { workflow } = await readWorkflow(AUDIT_WORKFLOW);
  const [job, ...others] = Object.values(workflow.jobs ?? {});
  assert.ok(job, `${AUDIT_WORKFLOW} must define an audit job`);
  assert.equal(others.length, 0, `${AUDIT_WORKFLOW} must define one audit job`);
  const steps = job.steps ?? [];
  const audit = namedStep(steps, "Audit main dependencies", AUDIT_WORKFLOW);
  for (const step of steps.slice(0, steps.indexOf(audit)))
    assert.equal(
      installsDependencies(step.run ?? ""),
      false,
      `${AUDIT_WORKFLOW} step "${step.name ?? "unnamed"}" must not install dependencies before "Audit main dependencies"; only the global npm pin is allowed`,
    );
});

test("the CI native job uses the minimum tested Node version", async () => {
  const { workflow } = await readWorkflow(CI_WORKFLOW);
  const native = workflow.jobs?.native;
  assert.ok(native, `${CI_WORKFLOW} must define the native job`);
  const node = namedStep(
    native.steps ?? [],
    "Set up Node.js",
    "ci.yml native job",
  );
  assert.ok(
    node.uses?.startsWith("actions/setup-node@"),
    "the CI native job's Set up Node.js step must use actions/setup-node",
  );
  assert.equal(
    String(node.with?.["node-version"]),
    String(TESTED_NODE_VERSIONS[0]),
    "the CI native job's node-version must equal TESTED_NODE_VERSIONS[0]",
  );
});

test("every workflow push trigger declares a non-empty branches array", async () => {
  const directory = ".github/workflows";
  const files = (await fs.readdir(path.join(repositoryRoot, directory)))
    .filter((name) => name.endsWith(".yml"))
    .sort();
  assert.ok(files.length > 0, "the repository must contain workflow YAML");
  for (const name of files) {
    const file = `${directory}/${name}`;
    const { workflow } = await readWorkflow(file);
    const trigger = workflow.on;
    let push: unknown;
    if (typeof trigger === "string" || Array.isArray(trigger)) {
      if (
        typeof trigger === "string"
          ? trigger !== "push"
          : !trigger.includes("push")
      )
        continue;
    } else {
      if (!trigger || !Object.hasOwn(trigger, "push")) continue;
      push = (trigger as Readonly<Record<string, unknown>>).push;
    }
    const branches =
      push && typeof push === "object"
        ? (push as { readonly branches?: unknown }).branches
        : undefined;
    assert.ok(
      Array.isArray(branches) && branches.length > 0,
      `${file} push trigger must declare a non-empty branches array; GitHub ignores paths filters for tag pushes`,
    );
  }
});

function installsDependencies(script: string): boolean {
  return [...script.matchAll(/\bnpm\s+(?:ci|install|i|add)\b[^\n;&|]*/gu)].some(
    ([command]) => !/^npm\s+install\s+--global\s+npm@\S+\s*$/u.test(command),
  );
}

function namedStep(
  steps: readonly WorkflowStep[],
  name: string,
  owner: string,
): WorkflowStep {
  const [step, ...others] = steps.filter(
    (candidate) => candidate.name === name,
  );
  assert.ok(step, `${owner} must have a "${name}" step`);
  assert.equal(others.length, 0, `${owner} must have one "${name}" step`);
  return step;
}

async function readWorkflow(
  file: string,
): Promise<{ workflow: Workflow; source: string }> {
  const source = await fs.readFile(path.join(repositoryRoot, file), "utf8");
  return { workflow: parse(source) as Workflow, source };
}
