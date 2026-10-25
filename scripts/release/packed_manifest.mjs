import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";

import { list } from "tar";

import { validatePackageReport } from "./archive.mjs";
import { validateExportFiles, validatePackageManifest } from "./manifest.mjs";
import { nativeTarget } from "./targets.mjs";

/** Inspect the archive itself so prepack cannot silently change the contract. */
export async function inspectPackedManifest(archivePath, report) {
  const bytes = await fs.readFile(archivePath);
  assert.equal(
    report.integrity,
    `sha512-${crypto.createHash("sha512").update(bytes).digest("base64")}`,
  );
  assert.equal(
    report.shasum,
    crypto.createHash("sha1").update(bytes).digest("hex"),
  );
  assert.equal(
    report.size,
    bytes.byteLength,
    "archive size must match its report",
  );
  validatePackageReport(report, report.name);
  const files = [];
  const native = report.name.startsWith("@mokly/native-")
    ? nativeTarget(report.name)
    : undefined;
  const binary = [];
  let json;
  await list({
    file: archivePath,
    onReadEntry(entry) {
      if (entry.type !== "Directory") {
        assert.equal(entry.type, "File", "packed paths must be regular files");
        assert.ok(entry.path.startsWith("package/"));
        files.push({
          path: entry.path.slice("package/".length),
          size: entry.size,
        });
      }
      if (native && entry.path === `package/bin/${native.executable}`)
        entry.on("data", (chunk) => binary.push(chunk));
      if (entry.path !== "package/package.json") return;
      assert.equal(json, undefined, "duplicate packed package.json");
      json = "";
      entry.on("data", (chunk) => {
        json += chunk.toString("utf8");
      });
    },
  });
  const sorted = (items) =>
    items
      .map(({ path, size }) => ({ path, size }))
      .sort((a, b) => a.path.localeCompare(b.path));
  assert.deepEqual(
    sorted(files),
    sorted(report.files),
    "archive inventory must match its report",
  );
  if (native)
    assert.ok(
      !Buffer.concat(binary).includes("MOKLY_TEST_"),
      `${native.name}: packed native binary contains MOKLY_TEST_`,
    );
  assert.equal(typeof json, "string", "missing packed package.json");
  const metadata = JSON.parse(json);
  validatePackageManifest(metadata, report.name);
  assert.equal(metadata.version, report.version);
  validateExportFiles(metadata, report);
  return metadata;
}
