import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";

import { list } from "tar";

import { validateExportFiles, validatePackageManifest } from "./manifest.mjs";

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
  let json;
  await list({
    file: archivePath,
    onReadEntry(entry) {
      if (entry.path !== "package/package.json") return;
      assert.equal(json, undefined, "duplicate packed package.json");
      json = "";
      entry.on("data", (chunk) => {
        json += chunk.toString("utf8");
      });
    },
  });
  assert.equal(typeof json, "string", "missing packed package.json");
  const metadata = JSON.parse(json);
  validatePackageManifest(metadata, report.name);
  assert.equal(metadata.version, report.version);
  validateExportFiles(metadata, report);
  return metadata;
}
