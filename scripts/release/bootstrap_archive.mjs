import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  createPackageArchive,
  inspectRuntimeLicenses,
} from "../package/archive.mjs";
import { runCommand } from "../package/command.mjs";

/** Build registration evidence from reviewed committed bytes, never local dist. */
export async function createBootstrapArchive({
  repositoryRoot,
  expectedCommit,
  destination,
  packageName = "@mokly/mokly",
}) {
  assert.match(
    expectedCommit,
    /^[a-f0-9]{40}$/,
    "bootstrap requires an explicit reviewed full commit SHA",
  );
  repositoryRoot = await fs.realpath(repositoryRoot);
  destination = path.resolve(destination);
  await verifySource(repositoryRoot, expectedCommit);
  const { relative, version, filename } = bootstrapTarget(packageName);
  await verifyPackage(repositoryRoot, relative, packageName, version);
  await requireMissingDestination(destination);
  const temporaryRoot = await fs.mkdtemp(
    path.join(os.tmpdir(), "mokly-bootstrap-"),
  );
  try {
    const checkout = path.join(temporaryRoot, "checkout");
    await runCommand("git", ["init", "--initial-branch=bootstrap", checkout]);
    await runCommand(
      "git",
      [
        "fetch",
        "--depth=1",
        "--no-tags",
        "--no-recurse-submodules",
        "--",
        repositoryRoot,
        expectedCommit,
      ],
      { cwd: checkout },
    );
    await runCommand("git", ["checkout", "--detach", expectedCommit], {
      cwd: checkout,
    });
    await verifySource(checkout, expectedCommit);
    await verifyPackage(checkout, relative, packageName, version);
    await runCommand("npm", ["ci", "--no-audit", "--no-fund"], {
      cwd: checkout,
    });
    await inspectRuntimeLicenses(checkout);
    const packed = await createPackageArchive(
      path.join(checkout, relative),
      path.join(temporaryRoot, "artifact"),
      packageName,
    );
    assert.equal(
      packed.report.version,
      version,
      `bootstrap is restricted to ${packageName}@${version}`,
    );
    assert.equal(packed.report.filename, filename);
    const sourceTree = await verifySource(checkout, expectedCommit);
    await verifySource(repositoryRoot, expectedCommit);
    const bytes = await fs.readFile(packed.archivePath);
    assert.equal(
      packed.report.integrity,
      `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`,
    );
    assert.equal(
      packed.report.shasum,
      crypto.createHash("sha1").update(bytes).digest("hex"),
    );
    const report = {
      ...packed.report,
      sourceCommit: expectedCommit,
      sourceTree,
    };
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.mkdir(destination);
    const archivePath = path.join(destination, report.filename);
    await fs.writeFile(archivePath, bytes, { flag: "wx" });
    await fs.writeFile(
      path.join(destination, "pack-report.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      { flag: "wx" },
    );
    return { archivePath, report };
  } finally {
    await fs.rm(temporaryRoot, { force: true, recursive: true });
  }
}

async function verifySource(repositoryRoot, expectedCommit) {
  const git = async (...args) =>
    (await runCommand("git", args, { cwd: repositoryRoot })).stdout.trim();
  assert.equal(
    await fs.realpath(await git("rev-parse", "--show-toplevel")),
    await fs.realpath(repositoryRoot),
    "bootstrap must run at the repository root",
  );
  assert.equal(
    await git("rev-parse", "HEAD"),
    expectedCommit,
    "the reviewed commit must equal HEAD",
  );
  assert.equal(
    await git(
      "status",
      "--porcelain=v1",
      "--untracked-files=all",
      "--ignore-submodules=none",
    ),
    "",
    "bootstrap requires a clean source tree (including staged and untracked files)",
  );
  return await git("rev-parse", "HEAD^{tree}");
}

function bootstrapTarget(packageName) {
  if (packageName === "@mokly/mokly")
    return {
      relative: ".",
      version: "0.8.0",
      filename: "mokly-mokly-0.8.0.tgz",
    };
  assert.equal(packageName, "@mokly/viewer", "unknown bootstrap package");
  return {
    relative: "packages/viewer",
    version: "0.1.0",
    filename: "mokly-viewer-0.1.0.tgz",
  };
}

async function verifyPackage(repositoryRoot, relative, packageName, version) {
  const metadata = JSON.parse(
    await fs.readFile(
      path.join(repositoryRoot, relative, "package.json"),
      "utf8",
    ),
  );
  assert.equal(
    `${metadata.name}@${metadata.version}`,
    `${packageName}@${version}`,
    `bootstrap is restricted to ${packageName}@${version}`,
  );
}

async function requireMissingDestination(destination) {
  try {
    await fs.lstat(destination);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`bootstrap destination already exists: ${destination}`);
}
