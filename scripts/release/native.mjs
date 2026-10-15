import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { createPackageArchive } from "./archive.mjs";
import { runCommand } from "./command.mjs";
import { nativeBuild } from "./native_build.mjs";
import { inspectNativeTls } from "./native_tls.mjs";
import { savePackage, sourceIdentity } from "./package_set.mjs";
import { inspectPackedManifest } from "./packed_manifest.mjs";
import { nativeTarget } from "./targets.mjs";

/** Build a release binary, or pack an explicitly supplied cross-built binary. */
export async function packNative(
  root,
  targetName,
  destination,
  binaryPath,
  options = {},
) {
  const execute = options.execute ?? runCommand;
  const inspect = options.inspect ?? inspectNativeTls;
  const target = nativeTarget(targetName);
  const build = binaryPath ? undefined : nativeBuild(root, target);
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
  if (build) {
    await execute(build.file, build.args, build.options);
    binaryPath = build.binary;
  }
  const bin = path.join(root, target.directory, "bin");
  await fs.rm(bin, { recursive: true, force: true });
  await fs.mkdir(bin, { recursive: true });
  const output = path.join(bin, target.executable);
  await fs.copyFile(binaryPath, output);
  await fs.chmod(output, 0o755);
  if (process.platform === target.os && process.arch === target.cpu) {
    const { stdout } = await execute(output, ["--version"], { cwd: root });
    assert.equal(
      stdout,
      `${cli.version}\n`,
      "the binary must embed the CLI package version",
    );
  }
  const inspection = await inspect(output, target.os);
  const artifact = path.join(destination, `native-${target.target}`);
  let packageRoot = path.join(root, target.directory);
  const stage = path.join(artifact, "registration-source");
  if (options.registration) {
    await fs.mkdir(path.join(stage, "bin"), { recursive: true });
    for (const file of ["README.md", "LICENSE", `bin/${target.executable}`])
      await fs.copyFile(path.join(packageRoot, file), path.join(stage, file));
    await fs.writeFile(
      path.join(stage, "package.json"),
      JSON.stringify({ ...metadata, version: "0.0.0" }, null, 2) + "\n",
    );
    packageRoot = stage;
  }
  try {
    const packed = await createPackageArchive(
      packageRoot,
      artifact,
      target.name,
    );
    await inspectPackedManifest(packed.archivePath, packed.report);
    if (options.registration) packed.report.binaryVersion = cli.version;
    await fs.writeFile(path.join(artifact, "tls-dependencies.txt"), inspection);
    return await savePackage(packed, await sourceIdentity(root));
  } finally {
    if (options.registration)
      await fs.rm(stage, { recursive: true, force: true });
  }
}
