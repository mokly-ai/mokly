import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { createPackageArchive, inspectRuntimeLicenses } from "./archive.mjs";
import { runCommand } from "./command.mjs";
import { inspectPublishedDocs } from "./packed_docs.mjs";
import { inspectPackedManifest } from "./packed_manifest.mjs";
import { downloadViewer } from "./published_viewer.mjs";
import { releasePackages } from "./targets.mjs";
import { verifyPackageVersions } from "./versions.mjs";

/** Bind a saved archive to the checkout that produced it. */
export async function sourceIdentity(root, ref = "HEAD") {
  const git = async (ref) =>
    (await runCommand("git", ["rev-parse", ref], { cwd: root })).stdout.trim();
  return {
    sourceCommit: await git(`${ref}^{commit}`),
    sourceTree: await git(`${ref}^{tree}`),
  };
}

export async function savePackage(packed, identity) {
  const report = { ...packed.report, ...identity };
  await fs.writeFile(
    path.join(path.dirname(packed.archivePath), "pack-report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return { ...packed, report };
}

/** Verify the downloaded bytes, manifest, version, and immutable source. */
export async function inspectReleasePackage(
  root,
  directory,
  descriptor,
  { reuseViewer = false } = {},
) {
  const artifact = path.join(directory, descriptor.artifact);
  const report = JSON.parse(
    await fs.readFile(path.join(artifact, "pack-report.json"), "utf8"),
  );
  assert.equal(report.name, descriptor.name);
  assert.equal(path.basename(report.filename), report.filename);
  const expected = JSON.parse(
    await fs.readFile(
      path.join(root, descriptor.directory, "package.json"),
      "utf8",
    ),
  );
  assert.equal(report.version, expected.version);
  const identity = await sourceIdentity(
    root,
    reuseViewer && descriptor.name === "@mokly/viewer"
      ? `viewer-v${expected.version}`
      : "HEAD",
  );
  assert.equal(
    report.sourceCommit,
    identity.sourceCommit,
    "archive must identify the release commit",
  );
  assert.equal(
    report.sourceTree,
    identity.sourceTree,
    "archive must identify the release tree",
  );
  const archivePath = path.join(artifact, report.filename);
  const manifest = await inspectPackedManifest(archivePath, report);
  assert.deepEqual(
    manifest,
    expected,
    "packed manifest must match the release source",
  );
  if (descriptor.name === "@mokly/mokly")
    await inspectPublishedDocs(archivePath, root);
  return { archivePath, report };
}

export async function inspectReleaseSet(root, directory, options = {}) {
  await verifyPackageVersions(root);
  const packed = [];
  for (const descriptor of releasePackages())
    packed.push(
      await inspectReleasePackage(root, directory, descriptor, options),
    );
  return packed;
}

/** Native archives are built elsewhere. Pack the viewer before CLI prepack. */
export async function packReleaseSet(root, destination, options = {}) {
  await verifyPackageVersions(root);
  await inspectRuntimeLicenses(root);
  const identity = await sourceIdentity(root);
  const packed = [];
  for (const descriptor of releasePackages()) {
    if (descriptor.name === "@mokly/viewer" && options.reuseViewer) {
      const archive = await downloadViewer(
        root,
        path.join(destination, descriptor.artifact),
      );
      packed.push(
        await savePackage(
          archive,
          await sourceIdentity(root, `viewer-v${archive.report.version}`),
        ),
      );
    } else if (descriptor.name.startsWith("@mokly/native-")) {
      packed.push(await inspectReleasePackage(root, destination, descriptor));
    } else {
      const archive = await createPackageArchive(
        path.join(root, descriptor.directory),
        path.join(destination, descriptor.artifact),
        descriptor.name,
      );
      await inspectPackedManifest(archive.archivePath, archive.report);
      packed.push(await savePackage(archive, identity));
    }
  }
  await inspectReleaseSet(root, destination, options);
  return packed;
}
