import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

export interface TurboTask {
  taskId: string;
  hash: string;
  inputs: Readonly<Record<string, string>>;
  dependencies: readonly string[];
  cache: { local: boolean; remote: boolean; status: string };
  resolvedTaskDefinition: { cache: boolean };
}

export interface TurboDryRun {
  envMode: string;
  globalCacheInputs: { hashOfInternalDependencies: string };
  tasks: readonly TurboTask[];
}

/** Invoke the installed repository binary with no remote credentials. */
export async function runTurbo(
  root: string,
  args: readonly string[],
): Promise<string> {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TURBO_CACHE: "local:rw",
    TURBO_TELEMETRY_DISABLED: "1",
  };
  for (const name of [
    "TURBO_TOKEN",
    "TURBO_API",
    "TURBO_TEAM",
    "TURBO_TEAMID",
    "TURBO_REMOTE_CACHE_SIGNATURE_KEY",
    "TURBO_FORCE",
  ])
    delete env[name];
  try {
    const { stdout } = await execute(
      path.join(repositoryRoot, "node_modules/.bin/turbo"),
      args,
      {
        cwd: root,
        env,
        maxBuffer: 8_000_000,
        timeout: 120_000,
      },
    );
    return stdout;
  } finally {
    await execute("git", ["diff", "--exit-code", "AGENTS.md"], {
      cwd: repositoryRoot,
    });
  }
}

export async function dryTurbo(root: string): Promise<TurboDryRun> {
  return JSON.parse(
    await runTurbo(root, ["run", "example:build", "--dry=json"]),
  ) as TurboDryRun;
}

export function taskHashes(run: TurboDryRun): Record<string, string> {
  return Object.fromEntries(run.tasks.map((task) => [task.taskId, task.hash]));
}

export async function gitInputFiles(
  root: string,
  locations: readonly string[],
): Promise<string[]> {
  const { stdout } = await execute(
    "git",
    [
      "ls-files",
      "--cached",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...locations.map((location) =>
        location.includes("*") ? `:(glob)${location}` : location,
      ),
    ],
    { cwd: root },
  );
  return stdout.split("\0").filter(Boolean);
}

/** Own every input mutation and cache directory inside an isolated repository. */
export async function createTurboFixture(
  context: TestContext,
  install = false,
): Promise<string> {
  const root = await fs.mkdtemp(
    path.join(repositoryRoot, ".context/turbo-fixture-"),
  );
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const { stdout } = await execute(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
    { cwd: repositoryRoot },
  );
  const files = stdout
    .split("\0")
    .filter((file) =>
      /^(?:src\/|packages\/viewer\/|examples\/(?:basic|imported-assets)\/|docs\/protocol\/|scripts\/(?:copy-assets|clean)\.mjs$|(?:package(?:-lock)?\.json|turbo\.json|tsconfig(?:\.build)?\.json|README\.md|AGENTS\.md|\.gitignore)$)/.test(
        file,
      ),
    );
  for (const file of files) {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.copyFile(path.join(repositoryRoot, file), path.join(root, file));
  }
  if (install)
    await execute("npm", ["ci", "--no-audit", "--no-fund"], {
      cwd: root,
      maxBuffer: 8_000_000,
      timeout: 120_000,
    });
  else
    await fs.symlink(
      path.join(repositoryRoot, "node_modules"),
      path.join(root, "node_modules"),
      "junction",
    );
  await execute("git", ["init", "-q", "-b", "main"], { cwd: root });
  await fs.appendFile(
    path.join(root, ".git/info/exclude"),
    "\n/node_modules\n",
  );
  await execute("git", ["add", "."], { cwd: root });
  await execute(
    "git",
    [
      "-c",
      "user.name=Mokly Test",
      "-c",
      "user.email=mokly@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      "core.hooksPath=/dev/null",
      "commit",
      "-qm",
      "test: turbo fixture",
    ],
    { cwd: root },
  );
  assert.equal(
    JSON.parse(await fs.readFile(path.join(root, "turbo.json"), "utf8"))
      .agentGuidance,
    false,
  );
  assert.equal(
    (await execute("git", ["ls-files", "node_modules"], { cwd: root })).stdout,
    "",
  );
  return root;
}

/** Restore an authored input even when an assertion fails. */
export async function withInputEdit<T>(
  root: string,
  relative: string,
  operation: () => Promise<T>,
): Promise<T> {
  const file = path.join(root, relative);
  const before = await fs.readFile(file);
  try {
    await fs.appendFile(file, "\n");
    return await operation();
  } finally {
    await fs.writeFile(file, before);
  }
}
