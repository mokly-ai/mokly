import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { readSourceTree } from "../scripts/verification/source-tree.mjs";
import {
  createTestboxDependencies,
  runTestboxSuite,
} from "../scripts/verification/testbox-suite.mjs";

const execute = promisify(execFile);
const CHILD = "MOKLY_TESTBOX_STAGING_GIT_CHILD";
const DIRECTORY = "MOKLY_TESTBOX_STAGING_GIT_DIRECTORY";
const REPOSITORY_VARIABLES = [
  "GIT_ALTERNATE_OBJECT_DIRECTORIES",
  "GIT_CONFIG",
  "GIT_CONFIG_PARAMETERS",
  "GIT_CONFIG_COUNT",
  "GIT_OBJECT_DIRECTORY",
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_IMPLICIT_WORK_TREE",
  "GIT_GRAFT_FILE",
  "GIT_INDEX_FILE",
  "GIT_NO_REPLACE_OBJECTS",
  "GIT_REPLACE_REF_BASE",
  "GIT_PREFIX",
  "GIT_SHALLOW_FILE",
  "GIT_COMMON_DIR",
];

test("wrapper staging restores committed rename and deletion views without changing identity", async () => {
  if (process.env[CHILD] !== "1") {
    const directory = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-testbox-staging-"),
    );
    try {
      const config = path.join(directory, "empty-global.gitconfig");
      await fs.writeFile(config, "");
      const env = { ...process.env };
      delete env.NODE_TEST_CONTEXT;
      for (const name of [...REPOSITORY_VARIABLES, "BLACKSMITH_ORG_TOKEN"])
        delete env[name];
      Object.assign(env, {
        GIT_CONFIG_GLOBAL: config,
        GIT_CONFIG_NOSYSTEM: "1",
        [CHILD]: "1",
        [DIRECTORY]: directory,
      });
      const { stdout } = await execute(
        process.execPath,
        ["--import", "tsx", "--test", fileURLToPath(import.meta.url)],
        { env },
      );
      assert.ok(stdout.includes("staging assertions passed"), stdout);
    } finally {
      await fs.rm(directory, { recursive: true, force: true });
    }
    return;
  }
  const directory = process.env[DIRECTORY]!;
  const cwd = path.join(directory, "repository");
  const home = path.join(directory, "home");
  const environment = { ...process.env, HOME: home };
  await fs.mkdir(cwd);
  const git = async (...args: string[]) =>
    (await execute("git", args, { cwd, env: environment })).stdout.trim();
  await git("init", "--initial-branch=fixture");
  await git("config", "user.name", "Staging Fixture");
  await git("config", "user.email", "staging@example.invalid");
  await fs.writeFile(
    path.join(cwd, "legacy.mjs"),
    "export const legacy = true;\n",
  );
  await fs.writeFile(path.join(cwd, "old-plan.md"), "# Old plan\n");
  const lockfile = '{"lockfileVersion":3}\n';
  await fs.writeFile(path.join(cwd, "package-lock.json"), lockfile);
  await git("add", "-A");
  await git("commit", "-m", "test: staging base");
  const base = await git("rev-parse", "HEAD");
  await git("mv", "legacy.mjs", "moved.mjs");
  await git("rm", "old-plan.md");
  await git("commit", "-m", "test: renamed and deleted files");
  await git("reset", "--soft", base);
  await git("read-tree", base);
  assert.ok((await git("ls-files", "--cached")).includes("old-plan.md"));
  assert.ok((await git("status", "--porcelain=v1")).includes("?? moved.mjs"));
  const fingerprint = await readSourceTree(cwd);
  const stamp = path.join(home, ".mokly-testbox", "package-lock.sha256");
  await fs.mkdir(path.dirname(stamp), { recursive: true });
  await fs.writeFile(
    stamp,
    `${createHash("sha256").update(lockfile).digest("hex")}\n`,
  );
  const dependencies = createTestboxDependencies({ cwd, environment });
  const actualCommand = dependencies.runCommand;
  let cargo = 0;
  dependencies.runCommand = async (command) => {
    if (command.file === "git") return actualCommand(command);
    assert.equal(command.file, "cargo");
    cargo++;
    return {
      exitCode: 0,
      signal: null,
      interrupted: null,
      stdout: "",
      stderr: "",
    };
  };
  assert.equal(
    await runTestboxSuite(
      ["--expect", fingerprint, "--suite", "repository"],
      dependencies,
    ),
    0,
  );
  assert.equal(cargo, 1);
  const changes = (await git("diff", "--name-status", "--find-renames", base))
    .split("\n")
    .map((line) => line.split("\t"));
  assert.ok(
    changes.some(
      ([status, from, to]) =>
        status?.startsWith("R") && from === "legacy.mjs" && to === "moved.mjs",
    ),
    JSON.stringify(changes),
  );
  assert.ok(
    changes.some(([status, name]) => status === "D" && name === "old-plan.md"),
  );
  const cached = (await git("ls-files", "--cached")).split("\n");
  assert.ok(!cached.includes("old-plan.md"));
  assert.ok(cached.includes("moved.mjs"));
  assert.equal(await git("rev-parse", "HEAD"), base);
  assert.equal(await readSourceTree(cwd), fingerprint);
  process.stdout.write("staging assertions passed\n");
});
