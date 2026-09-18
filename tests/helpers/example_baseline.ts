/** Isolate the real example's current files from unrelated checkout and branch history. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { loadConfig } from "../../dist/config/load.js";

import { copyExampleSources } from "./example_sources.js";
import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Commit source and tooling so normal composition can rebuild the isolated baseline. */
export async function createExampleBaseline(root: string) {
  await copyExampleSources(root);
  for (const name of [
    ".gitignore",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "scripts/copy-assets.mjs",
    "packages/viewer",
    "src",
  ])
    await fs.cp(path.join(repositoryRoot, name), path.join(root, name), {
      recursive: true,
      filter: (source) =>
        !source
          .split(path.sep)
          .some((part) => part === "dist" || part === "node_modules"),
    });
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  const git = (...args: string[]) => execute("git", args, { cwd: root });
  await git("init", "-q", "-b", "main");
  await git("config", "user.name", "Mokly Test");
  await git("config", "user.email", "mokly@example.invalid");
  await git("add", ".");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: unchanged example baseline",
  );
  return config;
}
