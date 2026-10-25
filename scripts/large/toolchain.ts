/** Isolated installs are optional; workspace reuse is labelled in every measurement. */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { platformPackage } from "../../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../../packages/mokly/src/runtime.mjs";
import { NATIVE_TARGETS } from "../release/targets.mjs";

const execute = promisify(execFile);
export type ToolchainMode = "workspace" | "install";
export type Command = (
  file: string,
  args: string[],
  options: { cwd: string; maxBuffer: number; timeout: number },
) => Promise<{ stdout: string; stderr: string }>;
export async function prepareToolchain(
  repository: string,
  root: string,
  mode: ToolchainMode,
  run: Command = execute,
) {
  if (mode === "workspace") {
    await fs.writeFile(
      path.join(root, "package.json"),
      JSON.stringify({
        name: "mokly-large-fixture",
        private: true,
        type: "module",
      }),
    );
    await fs.symlink(
      path.join(repository, "node_modules"),
      path.join(root, "node_modules"),
      "junction",
    );
    await fs.copyFile(
      path.join(repository, "package-lock.json"),
      path.join(root, "workspace-lock.json"),
    );
    return { mode, installMs: null };
  }
  const beginning = performance.now();
  const tooling = path.join(root, "tooling");
  await fs.mkdir(tooling);
  const native = platformPackage(
    process.platform,
    process.arch,
    systemRuntime().glibc,
  );
  const dependencies: Record<string, string> = {};
  const optionalDependencies: Record<string, string> = {};
  for (const name of [
    "@mokly/mokly",
    "@mokly/viewer",
    ...NATIVE_TARGETS.map((target) => target.name),
  ]) {
    const directory = path.join(
      repository,
      "packages",
      name.slice("@mokly/".length),
    );
    const packed = await run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", tooling],
      { cwd: directory, maxBuffer: 8 * 1024 * 1024, timeout: 600_000 },
    );
    const packedFiles = JSON.parse(packed.stdout) as { filename: string }[];
    const filename = packedFiles[0]?.filename;
    if (!filename) throw new Error(`npm pack returned no archive for ${name}`);
    const destination =
      name.startsWith("@mokly/native-") && name !== native
        ? optionalDependencies
        : dependencies;
    destination[name] = `file:tooling/${filename}`;
  }
  const lock = JSON.parse(
    await fs.readFile(path.join(repository, "package-lock.json"), "utf8"),
  );
  for (const name of [
    "@firna/ui",
    ...Object.keys(lock.packages["node_modules/@firna/ui"].peerDependencies),
  ]) {
    const version = lock.packages[`node_modules/${name}`]?.version;
    if (!version)
      throw new Error(`The large fixture requires a locked ${name}`);
    dependencies[name] = version;
  }
  await fs.writeFile(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "mokly-large-fixture",
        private: true,
        type: "module",
        dependencies,
        optionalDependencies,
        overrides: Object.fromEntries(
          ["@mokly/viewer", ...NATIVE_TARGETS.map((target) => target.name)].map(
            (name) => [name, `$${name}`],
          ),
        ),
      },
      null,
      2,
    ) + "\n",
  );
  for (const args of [
    [
      "install",
      "--package-lock-only",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
    ],
    ["ci", "--no-audit", "--no-fund"],
  ]) {
    await run("npm", args, {
      cwd: root,
      maxBuffer: 8 * 1024 * 1024,
      timeout: 600_000,
    });
  }
  return { mode, installMs: performance.now() - beginning };
}
