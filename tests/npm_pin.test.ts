import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";

/** The first npm release that writes lockfile `libc` fields (npm/cli#9025). */
const FIRST_NPM_WITH_LOCKFILE_LIBC = "11.11.0";
/** Workflows whose dependency installs must use the pinned npm. */
const PINNED_WORKFLOWS = ["ci.yml", "release.yml"] as const;
const NPM_PIN = /npm (?:install|i) (?:--global|-g) npm@(\S+)/gu;

interface WorkflowStep {
  run?: string;
}

interface WorkflowJob {
  steps?: readonly WorkflowStep[];
}

interface Workflow {
  jobs: Readonly<Record<string, WorkflowJob>>;
}

test("every automation npm pin matches the packageManager version", async () => {
  const pinned = await pinnedNpmVersion();
  const pins = (await automationSources()).flatMap(({ file, source }) =>
    [...source.matchAll(NPM_PIN)].map((match) => ({ file, version: match[1] })),
  );
  assert.ok(pins.length > 0, "workflows must pin npm");
  for (const pin of pins) assert.equal(pin.version, pinned, pin.file);
});

test("CI and release jobs set up the pinned npm before npm ci", async () => {
  const pinned = await pinnedNpmVersion();
  let installs = 0;
  for (const file of PINNED_WORKFLOWS) {
    const workflow = await readWorkflow(file);
    for (const [name, job] of Object.entries(workflow.jobs)) {
      const steps = job.steps ?? [];
      const install = steps.findIndex((step) => step.run === "npm ci");
      if (install < 0) continue;
      installs += 1;
      const setup = steps.findIndex(
        (step) => step.run === `npm install --global npm@${pinned}`,
      );
      assert.ok(
        setup >= 0 && setup < install,
        `${file}:${name} must set up npm ${pinned} before npm ci`,
      );
    }
  }
  assert.ok(installs > 0, "CI and release workflows must install dependencies");
});

test("the pinned npm is new enough to keep lockfile libc fields", async () => {
  const pinned = await pinnedNpmVersion();
  assert.ok(
    compareVersions(pinned, FIRST_NPM_WITH_LOCKFILE_LIBC) >= 0,
    `npm ${pinned} drops lockfile libc fields; pin npm ${FIRST_NPM_WITH_LOCKFILE_LIBC} or newer`,
  );
});

test("developer and protocol docs name the pinned npm version", async () => {
  const pinned = await pinnedNpmVersion();
  for (const file of [
    "README.md",
    "docs/protocol/ci-workflow.md",
    "docs/protocol/npm-release-management.md",
  ]) {
    const source = (await read(file)).replace(/\s+/gu, " ");
    assert.ok(
      source.includes(`npm ${pinned}`),
      `${file} must name npm ${pinned}`,
    );
  }
});

async function pinnedNpmVersion(): Promise<string> {
  const manifest = JSON.parse(await read("package.json")) as {
    packageManager?: string;
  };
  const version = /^npm@(\d+\.\d+\.\d+)$/u.exec(
    manifest.packageManager ?? "",
  )?.[1];
  assert.ok(version, "packageManager must pin an exact npm version");
  return version;
}

async function automationSources(): Promise<
  readonly { file: string; source: string }[]
> {
  const workflows = (
    await fs.readdir(path.join(repositoryRoot, ".github/workflows"))
  )
    .filter((name) => /\.ya?ml$/u.test(name))
    .map((name) => `.github/workflows/${name}`);
  const actionEntries = await fs.readdir(
    path.join(repositoryRoot, ".github/actions"),
    { withFileTypes: true },
  );
  const actions = actionEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => `.github/actions/${entry.name}/action.yml`);
  return await Promise.all(
    [...workflows, ...actions].map(async (file) => ({
      file,
      source: await read(file),
    })),
  );
}

async function readWorkflow(file: string): Promise<Workflow> {
  return parse(await read(`.github/workflows/${file}`)) as Workflow;
}

async function read(file: string): Promise<string> {
  return await fs.readFile(path.join(repositoryRoot, file), "utf8");
}

function compareVersions(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
