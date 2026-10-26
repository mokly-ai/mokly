import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import {
  assertNodeVersion,
  SUPPORTED_NODE_RANGE,
  TESTED_NODE_VERSIONS,
} from "../packages/mokly/src/version.mjs";

import { exampleServerCommand } from "./browser/example_servers.js";
import { EXAMPLE_BASE } from "./helpers/example_base.js";
import { repositoryRoot } from "./helpers/fixture.js";

const CI_WORKFLOW = ".github/workflows/ci.yml";
const TESTBOX_WORKFLOW = ".github/workflows/blacksmith-testbox.yml";
const FULL_HISTORY_WORKFLOWS = [CI_WORKFLOW];
const CHECKOUT_ACTIONS = ["useblacksmith/checkout@", "actions/checkout@"];
const PINNED_REVISION = /@[a-f0-9]{40}$/u;
const UNTRUSTED_PULL_REQUEST_FIELD =
  /\$\{\{[^}]*github\.event\.pull_request\.(?:head\.ref|labels)/u;
/** Workflows whose run steps receive every expression through env. */
const ENV_ONLY_WORKFLOWS = [
  ".github/workflows/dependency-audit.yml",
  ".github/workflows/native-bootstrap.yml",
];

interface AutomationStep {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly with?: Readonly<Record<string, unknown>>;
}

interface AutomationJob {
  readonly steps?: readonly AutomationStep[];
  readonly uses?: string;
}

interface AutomationDocument {
  readonly jobs?: Readonly<Record<string, AutomationJob>>;
  readonly runs?: { readonly steps?: readonly AutomationStep[] };
}

test("external actions pin commits and local workflows use the caller revision", async () => {
  const references: string[] = [];
  for (const file of await automationFiles()) {
    const { document } = await readDocument(file);
    for (const uses of actionReferences(document)) {
      if (uses.startsWith("./")) {
        assert.match(uses, /^\.\/\.github\/workflows\/[\w-]+\.ya?ml$/);
        assert.ok(existsSync(path.join(repositoryRoot, uses)));
      } else references.push(`${file}: ${uses}`);
    }
  }
  assert.ok(references.length > 0, "workflows and actions must use actions");
  assert.deepEqual(
    references.filter((reference) => !PINNED_REVISION.test(reference)),
    [],
    "pin every uses: reference to a 40-character lowercase commit revision",
  );
});

test("run steps never interpolate untrusted input", async () => {
  const ci = runScripts((await readDocument(CI_WORKFLOW)).document);
  assert.ok(ci.length > 0, "ci.yml runs scripts");
  assert.deepEqual(
    ci.filter((run) => UNTRUSTED_PULL_REQUEST_FIELD.test(run)),
    [],
    "pass pull request head refs and labels to ci.yml run steps through env",
  );
  for (const file of ENV_ONLY_WORKFLOWS) {
    const runs = runScripts((await readDocument(file)).document);
    assert.ok(runs.length > 0, `${file} runs scripts`);
    assert.deepEqual(
      runs.filter((run) => run.includes("${{")),
      [],
      `pass every expression to ${file} run steps through env`,
    );
  }
});

test("CI jobs that install dependencies check out full history", async () => {
  let checked = 0;
  for (const file of FULL_HISTORY_WORKFLOWS) {
    const { document } = await readDocument(file);
    for (const [name, job] of Object.entries(document.jobs ?? {})) {
      const steps = job.steps ?? [];
      const checkouts = steps.filter(isCheckout);
      if (checkouts.length === 0 || !steps.some(installsDependencies)) continue;
      checked += 1;
      for (const checkout of checkouts)
        assert.equal(
          checkout.with?.["fetch-depth"],
          0,
          `${file} job ${name} must check out full history with fetch-depth: 0`,
        );
    }
  }
  assert.ok(checked > 0, "CI jobs must install dependencies");
});

test("CI functional jobs use only the checked-out lockfile", async () => {
  const { document, source } = await readDocument(CI_WORKFLOW);
  for (const [name, job] of Object.entries(document.jobs ?? {})) {
    const steps = job.steps ?? [];
    if (!steps.some(installsDependencies)) continue;
    assert.equal(
      steps.some((step) => step.name === "Read baseline dependency lockfile"),
      false,
      `${name} must not read a baseline dependency lockfile`,
    );
    const commands = steps.map((step) => step.run ?? "").join("\n");
    assert.doesNotMatch(
      commands,
      /git merge-base HEAD origin\/main/u,
      `${name} must not resolve its cache input from origin/main`,
    );
    assert.doesNotMatch(
      commands,
      /(?:branch-point|baseline-package-lock|git show [^\n]*package-lock\.json)/u,
      `${name} must use the checked-out lockfile`,
    );
  }
  for (const reference of [/origin\/main/u, /baseline-package-lock/u])
    assert.doesNotMatch(
      source,
      reference,
      "ci.yml must not resolve origin/main or read a baseline lockfile",
    );
});

test("Node version files agree with the package engines and READMEs", async () => {
  const [nvmrc, manifestSource, lockSource, readme, packageReadme] =
    await Promise.all([
      readText(".nvmrc"),
      readText("package.json"),
      readText("package-lock.json"),
      readText("README.md"),
      readText("packages/mokly/README.md"),
    ]);
  const manifest = JSON.parse(manifestSource) as {
    engines: { node: string };
  };
  const lock = JSON.parse(lockSource) as {
    packages: { "": { engines: { node: string } } };
  };
  assert.equal(nvmrc.trim(), TESTED_NODE_VERSIONS.at(-1));
  assert.equal(manifest.engines.node, SUPPORTED_NODE_RANGE);
  const cli = JSON.parse(await readText("packages/mokly/package.json"));
  assert.equal(cli.engines.node, SUPPORTED_NODE_RANGE);
  for (const version of TESTED_NODE_VERSIONS) assertNodeVersion(version);
  const { satisfies } = await import("semver");
  assert.ok(
    satisfies(nvmrc.trim(), manifest.engines.node),
    ".nvmrc must select a supported Node version",
  );
  assert.equal(
    lock.packages[""].engines.node,
    manifest.engines.node,
    "the lockfile root engines must match package.json",
  );
  assert.ok(
    readme.includes(`\`${manifest.engines.node}\``),
    "the README must document the supported Node range",
  );
  assert.ok(
    packageReadme.includes(`\`${manifest.engines.node}\``),
    "the package README must document the supported Node range",
  );
  assert.ok(
    readme.includes("[`.nvmrc`](./.nvmrc)"),
    "development setup must follow the tested Node version",
  );
});

test("the Testbox toolchain matches the CI toolchain", async () => {
  const ci = (await readDocument(CI_WORKFLOW)).document;
  const testbox = (await readDocument(TESTBOX_WORKFLOW)).document;
  const testboxSteps = stepsOf(testbox);
  const repository =
    Object.values(ci.jobs ?? {}).find((job) =>
      job.steps?.some((step) => step.name === "Run repository verification"),
    )?.steps ?? [];
  const nativeSteps =
    Object.values(ci.jobs ?? {}).find((job) =>
      job.steps?.some((step) =>
        /cargo xtask check --suite native/.test(step.run ?? ""),
      ),
    )?.steps ?? [];
  const nodeVersion = namedStep(
    testboxSteps,
    "Set up Node.js",
    TESTBOX_WORKFLOW,
  ).with?.["node-version"];
  assert.equal(
    nodeVersion,
    namedStep(nativeSteps, "Set up Node.js", CI_WORKFLOW).with?.[
      "node-version"
    ],
  );
  assert.equal(nodeVersion, TESTED_NODE_VERSIONS[0]);
  for (const name of ["Set up npm", "Set up Rust"]) {
    const expected = namedStep(repository, name, "ci.yml repository job").run;
    assert.ok(expected, `the CI repository job's "${name}" step runs a script`);
    assert.equal(
      namedStep(testboxSteps, name, TESTBOX_WORKFLOW).run,
      expected,
      `the Testbox "${name}" step must match the CI repository job`,
    );
  }
});

test("shared example servers use the reserved unavailable base", () => {
  const args = exampleServerCommand();
  assert.equal(args[args.indexOf("--base") + 1], EXAMPLE_BASE);
  assert.equal(args[0], "packages/mokly/bin/mokly.mjs");
});

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

function stepsOf(document: AutomationDocument): AutomationStep[] {
  return [
    ...Object.values(document.jobs ?? {}).flatMap((job) => job.steps ?? []),
    ...(document.runs?.steps ?? []),
  ];
}

function actionReferences(document: AutomationDocument): string[] {
  const owners = [...Object.values(document.jobs ?? {}), ...stepsOf(document)];
  return owners.flatMap((owner) =>
    owner.uses === undefined ? [] : [String(owner.uses)],
  );
}

function runScripts(document: AutomationDocument): string[] {
  return stepsOf(document).flatMap((step) =>
    typeof step.run === "string" ? [step.run] : [],
  );
}

function isCheckout(step: AutomationStep): boolean {
  return CHECKOUT_ACTIONS.some((action) => step.uses?.startsWith(action));
}

function installsDependencies(step: AutomationStep): boolean {
  return /^\s*npm ci\b/mu.test(step.run ?? "");
}

function namedStep(
  steps: readonly AutomationStep[],
  name: string,
  owner: string,
): AutomationStep {
  const [step, ...others] = steps.filter(
    (candidate) => candidate.name === name,
  );
  assert.ok(step, `${owner} must have a "${name}" step`);
  assert.equal(others.length, 0, `${owner} must have one "${name}" step`);
  return step;
}

async function readDocument(
  file: string,
): Promise<{ document: AutomationDocument; source: string }> {
  const source = await readText(file);
  return { document: parse(source) as AutomationDocument, source };
}

async function readText(file: string): Promise<string> {
  return await fs.readFile(path.join(repositoryRoot, file), "utf8");
}
