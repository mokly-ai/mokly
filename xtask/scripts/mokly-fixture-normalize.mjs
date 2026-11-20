// Normalize producer attribution only after checking the workspace identity.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const FIXTURE_VERSION = "0.0.0";
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");
const envelopePath = "mokly-upload.json";
const markerPath = ".mokly-export-artifact";

export function freezeEnvelope(files, workspaceVersion) {
  const envelope = files.get(envelopePath);
  const marker = files.get(markerPath);
  const manifest = JSON.parse(envelope.toString("utf8"));
  const inventory = JSON.parse(marker.toString("utf8"));
  assert.equal(
    manifest.moklyVersion,
    workspaceVersion,
    "Captured Mokly version differs from the workspace",
  );
  const declared = inventory.files.filter(({ path }) => path === envelopePath);
  assert.equal(declared.length, 1);
  assert.equal(declared[0].sha256, sha256(envelope));
  assert.equal(declared[0].size, envelope.length);
  assert.equal(manifest.schemaVersion, 3);
  const pattern =
    /("exportedAt"\s*:\s*")\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z(")/g;
  const original = envelope.toString("utf8");
  assert.equal(
    [...original.matchAll(pattern)].length,
    1,
    "Unexpected exportedAt shape",
  );
  const versionPattern = /("moklyVersion"\s*:\s*")[^"]+(")/g;
  assert.equal(
    [...original.matchAll(versionPattern)].length,
    1,
    "Unexpected moklyVersion shape",
  );
  const fixed = Buffer.from(
    original
      .replace(
        pattern,
        (_, before, after) => `${before}2000-01-01T00:00:00.000Z${after}`,
      )
      .replace(
        versionPattern,
        (_, before, after) => `${before}${FIXTURE_VERSION}${after}`,
      ),
  );
  const digestPattern = new RegExp(
    `("path"\\s*:\\s*"mokly-upload\\.json"\\s*,\\s*"sha256"\\s*:\\s*")${declared[0].sha256}("\\s*,\\s*"size"\\s*:\\s*)${envelope.length}(\\s*})`,
    "g",
  );
  const markerText = marker.toString("utf8");
  assert.equal(
    [...markerText.matchAll(digestPattern)].length,
    1,
    "Unexpected envelope marker entry shape",
  );
  files.set(envelopePath, fixed);
  files.set(
    markerPath,
    Buffer.from(
      markerText.replace(
        digestPattern,
        (_, before, middle, after) =>
          `${before}${sha256(fixed)}${middle}${fixed.length}${after}`,
      ),
    ),
  );
}
