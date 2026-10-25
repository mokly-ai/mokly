import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createPackageArchive } from "../scripts/release/archive.mjs";
import { assertNoCryptoLibrary } from "../scripts/release/native_tls.mjs";
import {
  inspectReleasePackage,
  savePackage,
  sourceIdentity,
} from "../scripts/release/package_set.mjs";
import { inspectPackedManifest } from "../scripts/release/packed_manifest.mjs";
import { NATIVE_TARGETS } from "../scripts/release/targets.mjs";

import { bootstrapFixture } from "./helpers/bootstrap_fixture.js";
import { repositoryRoot } from "./helpers/fixture.js";

test("native archive verification binds all five inventories to version and source", async (t) => {
  const fixture = await bootstrapFixture(t);
  for (const target of NATIVE_TARGETS) {
    const directory = path.join(fixture.root, target.directory);
    await fs.cp(path.join(repositoryRoot, target.directory), directory, {
      recursive: true,
      filter: (source) => path.basename(source) !== "bin",
    });
    await fs.mkdir(path.join(directory, "bin"));
    // Synthetic bytes test archive boundaries. Real binaries are checked by the release smoke.
    await fs.writeFile(
      path.join(directory, "bin", target.executable),
      "synthetic native archive fixture\n",
    );
    const descriptor = { ...target, artifact: `native-${target.target}` };
    const packed = await createPackageArchive(
      directory,
      path.join(fixture.destination, descriptor.artifact),
      target.name,
    );
    const identity = await sourceIdentity(fixture.root);
    const saved = await savePackage(packed, identity);
    await inspectReleasePackage(fixture.root, fixture.destination, descriptor);
    const reportPath = path.join(
      path.dirname(saved.archivePath),
      "pack-report.json",
    );
    for (const mutation of [
      { sourceCommit: "c".repeat(40) },
      { sourceTree: "c".repeat(40) },
      { version: "0.0.1" },
      { name: "@mokly/native-unknown" },
      {
        files: saved.report.files.map((file) => ({
          ...file,
          size: file.size + 1,
        })),
      },
    ]) {
      await fs.writeFile(
        reportPath,
        JSON.stringify({ ...saved.report, ...mutation }),
      );
      await assert.rejects(
        inspectReleasePackage(fixture.root, fixture.destination, descriptor),
      );
    }
    await fs.writeFile(reportPath, JSON.stringify(saved.report));
    await fs.appendFile(saved.archivePath, "modified");
    await assert.rejects(
      inspectReleasePackage(fixture.root, fixture.destination, descriptor),
      /sha512-/,
    );
  }
});

test("native dependency inspection accepts system TLS and rejects crypto shared libraries", () => {
  for (const output of [
    "libc.so.6 libm.so.6",
    "/usr/lib/libSystem.B.dylib /System/Library/Frameworks/Security.framework",
    "KERNEL32.dll bcrypt.dll crypt32.dll",
  ])
    assertNoCryptoLibrary(output);
  for (const output of [
    "libcrypto.so.3",
    "libssl.so",
    "/usr/local/lib/libcrypto.3.dylib",
    "libcrypto-3-x64.dll",
    "libaws_lc.so",
  ])
    assert.throws(() => assertNoCryptoLibrary(output), /crypto shared library/);
});

test("every packed native target rejects test hooks in its executable bytes", async (t) => {
  const fixture = await bootstrapFixture(t);
  for (const target of NATIVE_TARGETS) {
    const directory = path.join(fixture.root, target.directory);
    await fs.cp(path.join(repositoryRoot, target.directory), directory, {
      recursive: true,
      filter: (source) => path.basename(source) !== "bin",
    });
    await fs.mkdir(path.join(directory, "bin"));
    const binary = path.join(directory, "bin", target.executable);
    const pack = () =>
      createPackageArchive(
        directory,
        path.join(fixture.destination, target.target),
        target.name,
      );
    const clean = Buffer.concat([
      Buffer.alloc(65_530, 0xff),
      Buffer.from("MOKLY_VERSION\0"),
    ]);
    await fs.writeFile(binary, clean);
    const accepted = await pack();
    await inspectPackedManifest(accepted.archivePath, accepted.report);

    await fs.writeFile(
      binary,
      Buffer.concat([clean, Buffer.from("MOKLY_TEST_FAULT\0")]),
    );
    const rejected = await pack();
    // The gate must inspect the archive even if the source binary is clean.
    await fs.writeFile(binary, clean);
    await assert.rejects(
      inspectPackedManifest(rejected.archivePath, rejected.report),
      /packed native binary contains MOKLY_TEST_/,
    );
  }
});
