/** Disposable Git inputs for repository policy integration tests. */

import { execFileSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { scratchDirectory } from "../../../../apps/_tests_/scratch.mjs";
import { fixtureGitEnvironment } from "../../../../apps/mockups/src/_tests_/git-environment.mjs";
import { repository } from "./generated-output-fixture";

export async function policyFixture() {
  const root = scratchDirectory(
    path.join(repository, ".context", "output-policy-"),
  );
  const git = (...args: string[]) =>
    execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      env: fixtureGitEnvironment(),
    });
  const write = async (file: string, content: string) => {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), content);
  };
  git("init", "--quiet", "--initial-branch=fixture");
  return {
    root,
    git,
    write,
    cleanup: () => rm(root, { force: true, recursive: true }),
  };
}
