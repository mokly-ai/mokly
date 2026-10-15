import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { createPackageArchive } from "./archive.mjs";
import { runCommand } from "./command.mjs";
import { savePackage, sourceIdentity } from "./package_set.mjs";
import { inspectPackedManifest } from "./packed_manifest.mjs";
import { nativeTarget } from "./targets.mjs";

/** Build a release binary, or pack an explicitly supplied cross-built binary. */
export async function packNative(root, targetName, destination, binaryPath) {
  const target = nativeTarget(targetName);
  const cli = JSON.parse(
    await fs.readFile(path.join(root, "packages/mokly/package.json"), "utf8"),
  );
  const metadata = JSON.parse(
    await fs.readFile(
      path.join(root, target.directory, "package.json"),
      "utf8",
    ),
  );
  assert.equal(metadata.version, cli.version);
  const targetDir = path.join(root, "target/release-native");
  if (!binaryPath) {
    await runCommand(
      "cargo",
      [
        "build",
        "--locked",
        "--release",
        "--package",
        "mokly-cli",
        "--bin",
        "mokly",
        "--target",
        target.triple,
        "--target-dir",
        targetDir,
      ],
      { cwd: root },
    );
    binaryPath = path.join(
      targetDir,
      target.triple,
      "release",
      target.executable,
    );
  }
  const bin = path.join(root, target.directory, "bin");
  await fs.rm(bin, { recursive: true, force: true });
  await fs.mkdir(bin, { recursive: true });
  const output = path.join(bin, target.executable);
  await fs.copyFile(binaryPath, output);
  await fs.chmod(output, 0o755);
  if (process.platform === target.os && process.arch === target.cpu) {
    const { stdout } = await runCommand(output, ["--version"], { cwd: root });
    assert.equal(
      stdout,
      `${cli.version}\n`,
      "the binary must embed the CLI package version",
    );
  }
  const packed = await createPackageArchive(
    path.join(root, target.directory),
    path.join(destination, `native-${target.target}`),
    target.name,
  );
  await inspectPackedManifest(packed.archivePath, packed.report);
  return await savePackage(packed, await sourceIdentity(root));
}
