/** Startup acceptance uses a built release binary, verified at the shim's package. */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";

import { platformPackage } from "../../packages/mokly/src/platform.mjs";
import { systemRuntime } from "../../packages/mokly/src/runtime.mjs";
import { nativeBuild } from "../release/native_build.mjs";
import { nativeTarget } from "../release/targets.mjs";
import type { NativeTarget } from "../release/targets.mjs";

export interface AcceptanceBuild {
  profile: "release";
  target: string;
  binarySha256: string;
  sourceCommit: string;
  sourceTree: string;
  dirty: boolean;
}
export type BuildCommand = (
  file: string,
  args: string[],
  options: {
    cwd: string;
    env: NodeJS.ProcessEnv;
    maxBuffer: number;
    timeout: number;
  },
) => Promise<{ stdout: string; stderr: string }>;

const execute = promisify(execFile);
function hostTarget() {
  return nativeTarget(
    platformPackage(process.platform, process.arch, systemRuntime().glibc),
  );
}
async function digest(file: string) {
  return createHash("sha256")
    .update(await fs.readFile(file))
    .digest("hex");
}

/** Keep release packaging's profile and host target without its distribution libc floor. */
export function acceptanceCommand(repository: string, target: NativeTarget) {
  const build = nativeBuild(repository, target);
  build.args[0] = "build";
  build.args[build.args.indexOf("--target") + 1] = target.triple;
  return build;
}

export async function buildAcceptanceBinary(
  repository: string,
  run: BuildCommand = execute,
): Promise<AcceptanceBuild> {
  const target = hostTarget();
  const build = acceptanceCommand(repository, target);
  const settings = {
    ...build.options,
    env: {
      ...process.env,
      ...build.options.env,
      CARGO_BUILD_JOBS: "4",
      CARGO_PROFILE_DEV_DEBUG: "0",
      CARGO_INCREMENTAL: "0",
    },
    maxBuffer: 8 * 1024 * 1024,
    timeout: 600_000,
  };
  const compiled = await run(build.file, build.args, settings);
  const evidence = path.join(repository, ".context/large-acceptance");
  await fs.mkdir(evidence, { recursive: true });
  await fs.writeFile(
    path.join(evidence, "build.log"),
    compiled.stdout + compiled.stderr,
  );
  const destination = path.join(
    repository,
    target.directory,
    "bin",
    target.executable,
  );
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(build.binary, destination);
  await fs.chmod(destination, 0o755);
  const git = async (...args: string[]) =>
    (await run("git", args, settings)).stdout.trim();
  const record: AcceptanceBuild = {
    profile: "release",
    target: target.target,
    binarySha256: await digest(destination),
    sourceCommit: await git("rev-parse", "HEAD"),
    sourceTree: await git("write-tree"),
    dirty: (await git("status", "--porcelain")) !== "",
  };
  await fs.writeFile(
    path.join(evidence, "build.json"),
    JSON.stringify(record, null, 2) + "\n",
  );
  return record;
}

export async function verifyAcceptanceBinary(
  root: string,
  build: AcceptanceBuild | undefined,
) {
  if (
    !build ||
    build.profile !== "release" ||
    build.target !== hostTarget().target
  )
    throw new Error(
      "Startup acceptance needs a release binary; generate the fixture again.",
    );
  const shim = await fs.realpath(
    path.join(root, "node_modules/@mokly/mokly/bin/mokly.mjs"),
  );
  const require = createRequire(
    path.resolve(path.dirname(shim), "../dist/runtime.mjs"),
  );
  const target = hostTarget();
  const manifest = require.resolve(`${target.name}/package.json`);
  const binary = path.join(path.dirname(manifest), "bin", target.executable);
  if ((await digest(binary)) !== build.binarySha256)
    throw new Error(
      "The fixture binary differs from its release build; generate the fixture again.",
    );
  return build;
}

export async function acceptanceForFixture(fixture: {
  root: string;
  toolchain: { mode: "workspace" | "install" };
  acceptanceBuild?: AcceptanceBuild;
}) {
  const build =
    fixture.toolchain.mode === "workspace"
      ? await buildAcceptanceBinary(path.resolve(import.meta.dirname, "../.."))
      : fixture.acceptanceBuild;
  return verifyAcceptanceBinary(fixture.root, build);
}
