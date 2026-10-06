import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { baselineEnvironment } from "../../dist/baseline/commands.js";
import { NodeBaselineProcessRunner } from "../../dist/baseline/process.js";

const execute = promisify(execFile);

export const directBaselineCommands = [
  ["npm", "ci"],
  ["npm", "run", "--silent", "build", "--workspace", "@mokly/viewer"],
  [
    "node",
    "node_modules/typescript/bin/tsc",
    "--project",
    "tsconfig.build.json",
  ],
  ["node", "scripts/copy-assets.mjs"],
  [
    "node",
    "dist/cli/bin.js",
    "build",
    "--config",
    "examples/basic/mokly.config.ts",
  ],
] as const;

export async function commitBaselineInputs(
  root: string,
  label: string,
): Promise<string> {
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
      label,
    ],
    { cwd: root },
  );
  return (
    await execute("git", ["rev-parse", "HEAD"], { cwd: root })
  ).stdout.trim();
}

/** Use the actual nested ignored location and baseline process environment. */
export async function buildNestedBaseline(
  root: string,
  linked: string,
  commit: string,
  commands: readonly (readonly string[])[],
): Promise<string> {
  const source = path.join(linked, ".mokly-cache/baselines", commit, "source");
  await fs.mkdir(source, { recursive: true });
  const archive = path.join(source, "archive.tar");
  await execute(
    "git",
    ["archive", "--format=tar", "--output", archive, commit],
    { cwd: root },
  );
  await execute("tar", ["xf", archive, "-C", source]);
  await fs.rm(archive);
  const runner = new NodeBaselineProcessRunner();
  const env = baselineEnvironment(process.env, commit);
  for (const argv of commands) {
    const result = await runner.run({ argv, cwd: source, env });
    assert.equal(result.exitCode, 0, `${argv.join(" ")}\n${result.output}`);
    assert.doesNotMatch(
      result.output,
      /FULL TURBO|cache hit|cache miss|cache bypass|Remote caching|telemetry/i,
    );
  }
  return source;
}

/** Reproduce pre-Turbo package scripts without depending on remote Git history. */
export async function useLegacyBuildScripts(root: string): Promise<void> {
  const metadata = JSON.parse(
    await fs.readFile(path.join(root, "package.json"), "utf8"),
  );
  metadata.scripts.build =
    "npm run -s build --workspace @mokly/viewer && tsc --project tsconfig.build.json && node scripts/copy-assets.mjs";
  metadata.scripts["prepare:verification"] =
    "npm run build && npm run example:build";
  metadata.scripts["example:build"] = directBaselineCommands[4].join(" ");
  delete metadata.scripts["build:package"];
  delete metadata.devDependencies.turbo;
  const lock = JSON.parse(
    await fs.readFile(path.join(root, "package-lock.json"), "utf8"),
  );
  delete lock.packages[""].devDependencies.turbo;
  for (const name of Object.keys(lock.packages))
    if (
      name === "node_modules/turbo" ||
      name.startsWith("node_modules/@turbo/")
    )
      delete lock.packages[name];
  await fs.writeFile(
    path.join(root, "package.json"),
    `${JSON.stringify(metadata, null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(root, "package-lock.json"),
    `${JSON.stringify(lock, null, 2)}\n`,
  );
  await fs.rm(path.join(root, "turbo.json"));
  const viewerPath = path.join(root, "packages/viewer/package.json");
  const viewer = JSON.parse(await fs.readFile(viewerPath, "utf8"));
  viewer.scripts.build =
    "tsc --project tsconfig.build.json && node scripts/build.mjs";
  await fs.writeFile(viewerPath, `${JSON.stringify(viewer, null, 2)}\n`);
}
