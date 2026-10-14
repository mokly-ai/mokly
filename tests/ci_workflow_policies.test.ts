import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

const root = path.resolve(import.meta.dirname, "..");
interface Step {
  name?: string;
  uses?: string;
  run?: string;
  with?: Record<string, unknown>;
}
interface Workflow {
  jobs: Record<string, { uses?: string; steps?: Step[]; needs?: string[] }>;
}
async function read(file: string): Promise<Workflow> {
  return parse(await fs.readFile(path.join(root, file), "utf8")) as Workflow;
}

test("workflows and composite actions pin every action to a full commit", async () => {
  const files = (await fs.readdir(path.join(root, ".github/workflows")))
    .filter((name) => /\.ya?ml$/.test(name))
    .map((name) => `.github/workflows/${name}`);
  for (const name of await fs.readdir(path.join(root, ".github/actions")))
    files.push(`.github/actions/${name}/action.yml`);
  let count = 0;
  for (const file of files) {
    const document = (await read(file)) as Workflow & {
      runs?: { steps?: Step[] };
    };
    const owners = [
      ...Object.values(document.jobs ?? {}),
      ...Object.values(document.jobs ?? {}).flatMap((job) => job.steps ?? []),
      ...(document.runs?.steps ?? []),
    ];
    for (const owner of owners)
      if (owner.uses) {
        count++;
        assert.match(owner.uses, /@[a-f0-9]{40}$/, file);
      }
  }
  assert.ok(count > 0);
});

test("CI retains repository and unsharded viewer jobs with complete history", async () => {
  const ci = await read(".github/workflows/ci.yml");
  assert.deepEqual(Object.keys(ci.jobs).sort(), [
    "repository",
    "required",
    "viewer",
  ]);
  assert.deepEqual(ci.jobs.required?.needs, ["repository", "viewer"]);
  for (const name of ["repository", "viewer"]) {
    const steps = ci.jobs[name]?.steps ?? [];
    assert.ok(steps.some((step) => step.run === "npm ci"));
    const checkout = steps.find((step) => step.uses?.includes("/checkout@"));
    assert.equal(checkout?.with?.["fetch-depth"], 0);
    const commands = steps.map((step) => step.run ?? "").join("\n");
    assert.match(commands, new RegExp(`cargo xtask check --suite ${name}`));
    assert.doesNotMatch(
      commands,
      /--shard|baseline-package-lock|git merge-base/,
    );
  }
});

test("run steps receive untrusted pull request fields through environment values", async () => {
  for (const file of ["ci.yml", "dependency-audit.yml"]) {
    const document = await read(`.github/workflows/${file}`);
    const commands = Object.values(document.jobs).flatMap(
      (job) => job.steps ?? [],
    );
    for (const step of commands)
      assert.doesNotMatch(
        step.run ?? "",
        /\$\{\{[^}]*github\.event\.pull_request\.(?:head\.ref|labels)/,
        file,
      );
  }
});

test("Testbox keeps the Node, npm, and Rust toolchain for reduced suites", async () => {
  const box = await read(".github/workflows/blacksmith-testbox.yml");
  const steps = box.jobs.testbox?.steps ?? [];
  assert.equal(
    steps.find((step) => step.name === "Set up Node.js")?.with?.[
      "node-version"
    ],
    "22.14.0",
  );
  assert.equal(
    steps.find((step) => step.name === "Set up npm")?.run,
    "npm install --global npm@11.21.0",
  );
  assert.equal(
    steps.find((step) => step.name === "Set up Rust")?.run,
    "rustup toolchain install",
  );
  assert.ok(steps.some((step) => step.name === "Stamp installed lockfile"));
});
