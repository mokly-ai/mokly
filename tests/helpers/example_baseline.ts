/** Isolate the real example's current files from unrelated checkout and branch history. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { compileCatalogue } from "../../dist/build/compile.js";
import { writeCompilation } from "../../dist/build/transaction.js";
import { loadConfig } from "../../dist/config/load.js";

import { configureFocusedExample } from "./example_profiles.js";
import { copyExampleSources } from "./example_sources.js";
import { repositoryRoot } from "./fixture.js";

const execute = promisify(execFile);

/** Commit source and tooling so normal composition can rebuild the isolated baseline. */
export async function createExampleBaseline(root: string) {
  await copyExampleRepository(root);
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  await initializeRepository(root);
  return config;
}

/** Build a focused v9 committed baseline with current code for browser fixtures. */
export async function createCommittedExampleBaseline(
  root: string,
  profile: "design-library" | "ordinary-preview" | "static-example",
) {
  await copyExampleRepository(root);
  await configureFocusedExample(root, profile);
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  await writeCompilation(await compileCatalogue(config), config);
  await initializeRepository(root, true);
  return config;
}

async function copyExampleRepository(root: string): Promise<void> {
  await copyExampleSources(root);
  for (const name of [
    ".gitignore",
    "package.json",
    "package-lock.json",
    "turbo.json",
    "tsconfig.json",
    "tsconfig.build.json",
    "scripts/clean.mjs",
    "scripts/copy-assets.mjs",
    "scripts/preview",
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
}

/** Commit the fixture without detached Git maintenance that could race cleanup. */
async function initializeRepository(
  root: string,
  generated = false,
): Promise<void> {
  const git = (...args: string[]) => execute("git", args, { cwd: root });
  await git("init", "-q", "-b", "main");
  await git("config", "maintenance.auto", "false");
  await git("config", "gc.auto", "0");
  await git("config", "user.name", "Mokly Test");
  await git("config", "user.email", "mokly@example.invalid");
  await git("add", ".");
  if (generated) await git("add", "-f", "examples/basic/mokly-generated");
  await git(
    "-c",
    "core.hooksPath=/dev/null",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-qm",
    "test: unchanged example baseline",
  );
}

/** Keep real build commands and commit source only for historical reconstruction. */
export async function createSourceExampleBaseline(
  root: string,
  profile: "shared-export" | "static-example" = "shared-export",
) {
  await copyExampleRepository(root);
  await configureFocusedExample(root, profile, true);
  const config = await loadConfig(root, "examples/basic/mokly.config.ts");
  await initializeRepository(root);
  return config;
}
