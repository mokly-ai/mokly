import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";
import { promisify } from "node:util";

import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);
const repositoryVariables = [
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

/** Empty global config and clean repository selection for fixture children. */
export async function isolatedGitEnvironment(config: string) {
  await fs.writeFile(config, "");
  const env = { ...process.env };
  for (const name of [...repositoryVariables, "BLACKSMITH_ORG_TOKEN"])
    delete env[name];
  return { ...env, GIT_CONFIG_GLOBAL: config, GIT_CONFIG_NOSYSTEM: "1" };
}

/** One real repository whose Git and fingerprint children share isolated config. */
export async function typeRepository(context: TestContext) {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-tree-types-"),
  );
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const root = path.join(directory, "repository");
  await fs.mkdir(root);
  const env = await isolatedGitEnvironment(
    path.join(directory, "global.gitconfig"),
  );
  const git = async (...args: string[]) =>
    (await execute("git", args, { cwd: root, env })).stdout.trim();
  await git("init", "--initial-branch=fixture");
  await git("config", "user.name", "Fingerprint Fixture");
  await git("config", "user.email", "fingerprint@example.invalid");
  await git("config", "core.excludesFile", env.GIT_CONFIG_GLOBAL);
  const write = async (name: string, contents: string) => {
    const file = path.join(root, name);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents);
    await fs.chmod(file, 0o644);
  };
  const commit = async () => {
    await git("add", "-A");
    await git("commit", "-m", "test: fingerprint tree");
    return await git("rev-parse", "HEAD");
  };
  const boxState = async (base: string) => {
    await commit();
    await git("reset", "--soft", base);
    await git("read-tree", base);
  };
  const fingerprint = async () =>
    (
      await execute(
        process.execPath,
        [path.join(repositoryRoot, "scripts/verification/source-tree.mjs")],
        { cwd: root, env },
      )
    ).stdout.trim();
  const nested = async (name: string) => {
    const target = path.join(root, name);
    await git("init", "--initial-branch=nested", target);
    await execute(
      "git",
      ["-C", target, "config", "user.name", "Nested Fixture"],
      { env },
    );
    await execute(
      "git",
      ["-C", target, "config", "user.email", "nested@example.invalid"],
      { env },
    );
    await fs.writeFile(path.join(target, "file"), "nested\n");
    await execute("git", ["-C", target, "add", "file"], { env });
    await execute("git", ["-C", target, "commit", "-m", "test: nested tree"], {
      env,
    });
  };
  return { root, git, write, commit, boxState, fingerprint, nested };
}
