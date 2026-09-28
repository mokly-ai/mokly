import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { parse } from "yaml";

import { repositoryRoot } from "./helpers/fixture.js";
import { remoteStateDeletingCommands } from "./helpers/remote_state_commands.js";

interface AutomationStep {
  readonly run?: unknown;
}

interface WorkflowDocument {
  readonly jobs?: Readonly<
    Record<string, { readonly steps?: readonly AutomationStep[] }>
  >;
  readonly runs?: { readonly steps?: readonly AutomationStep[] };
}

test("remote-state guard recognizes every prohibited command form", () => {
  const prohibited = [
    "git remote remove origin",
    "git remote rm upstream",
    "git -C repository remote remove origin",
    "git -c protocol.version=2 remote rm origin",
    "git update-ref -d refs/heads/example",
    "git update-ref --delete refs/heads/example",
    "git update-ref --stdin",
    "git update-ref refs/remotes/origin/main HEAD",
    "git branch -dr origin/example",
    "git branch -rd origin/example",
    "git branch -Dr origin/example",
    "git branch -rD origin/example",
    "git branch -d -r origin/example",
    "git branch -D -r origin/example",
    "git branch --delete --remotes origin/example",
    "git branch --delete -r origin/example",
    "git branch --unset-upstream",
    "git config --unset remote.origin.url",
    "git config --unset-all branch.main.merge",
    "git config --remove-section remote.origin",
    "node scripts/verification/remove-remote-state.mjs",
  ];
  for (const command of prohibited)
    assert.deepEqual(
      remoteStateDeletingCommands([command]),
      [command],
      command,
    );
});

test("remote-state guard handles blocks, continuations and old cleanup steps", () => {
  const oldInline = `git for-each-ref --format='delete %(refname)' refs/remotes/ |
  git update-ref --stdin`;
  const continued = `git -C repository \\
  -c protocol.version=2 \\
  update-ref \\
  --stdin`;
  const oldScript = "node scripts/verification/remove-remote-state.mjs";
  const chained = "printf 'ready' && git remote remove origin";

  assert.equal(remoteStateDeletingCommands([oldInline]).length, 1);
  assert.equal(remoteStateDeletingCommands([continued]).length, 1);
  assert.deepEqual(remoteStateDeletingCommands([oldScript]), [oldScript]);
  assert.deepEqual(remoteStateDeletingCommands([chained]), [
    "git remote remove origin",
  ]);
});

test("remote-state guard permits read-only and unrelated commands", () => {
  const allowed = [
    "git fetch origin",
    "git fetch --prune",
    "git remote -v",
    "git update-ref refs/heads/x HEAD",
    "git branch -d feature",
    "git config --get remote.origin.url",
    "git log origin/main",
    'echo "remote work remains"',
    'echo "git remote remove origin"',
  ];
  assert.deepEqual(remoteStateDeletingCommands(allowed), []);
});

test("workflows and composite actions never delete remote Git state", async () => {
  for (const { commands, file } of await automationCommands()) {
    const deleting = remoteStateDeletingCommands(commands);
    assert.deepEqual(
      deleting,
      [],
      `${file} deletes remote Git state:\n${deleting.join("\n")}`,
    );
  }
});

async function automationCommands(): Promise<
  Array<{ commands: string[]; file: string }>
> {
  const files = await automationFiles();
  return Promise.all(
    files.map(async (file) => {
      const document = parse(
        await fs.readFile(path.join(repositoryRoot, file), "utf8"),
      ) as WorkflowDocument;
      const workflowSteps = Object.values(document.jobs ?? {}).flatMap(
        (job) => job.steps ?? [],
      );
      const steps = [...workflowSteps, ...(document.runs?.steps ?? [])];
      return {
        commands: steps.flatMap((step) =>
          typeof step.run === "string" ? [step.run] : [],
        ),
        file,
      };
    }),
  );
}

async function automationFiles(): Promise<string[]> {
  const workflows = (
    await fs.readdir(path.join(repositoryRoot, ".github/workflows"))
  )
    .filter((name) => /\.ya?ml$/u.test(name))
    .map((name) => `.github/workflows/${name}`);
  const actions: string[] = [];
  const actionRoot = path.join(repositoryRoot, ".github/actions");
  for (const entry of await fs.readdir(actionRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(actionRoot, entry.name, "action.yml");
    try {
      if ((await fs.stat(file)).isFile())
        actions.push(`.github/actions/${entry.name}/action.yml`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return [...workflows, ...actions].sort();
}
