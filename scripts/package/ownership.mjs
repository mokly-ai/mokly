import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const MARKER = ".mokly-export-artifact";
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_PATH_BYTES = 1024;
const SHA256 = /^[a-f0-9]{64}$/;

class OwnershipMarkerError extends Error {
  constructor(rejection) {
    super(`Ownership marker rejected: ${rejection}`);
    this.name = "OwnershipMarkerError";
    this.rejection = rejection;
  }
}

/** Independent marker-shape reader for package conformance, not a full receiver. */
export function assertOwnershipMarker(value) {
  if (!isRecord(value) || !Object.hasOwn(value, "schemaVersion"))
    throw new OwnershipMarkerError("invalid");
  if (value.schemaVersion !== 2)
    throw new OwnershipMarkerError("unsupported-version");
  if (!Object.hasOwn(value, "files") || !Array.isArray(value.files))
    throw new OwnershipMarkerError("invalid");
  const seen = new Set();
  const entries = [];
  for (const entry of value.files) {
    if (!isOwnershipEntry(entry)) throw new OwnershipMarkerError("invalid");
    const folded = entry.path.toLowerCase();
    if (seen.has(folded)) throw new OwnershipMarkerError("invalid");
    seen.add(folded);
    entries.push({
      path: entry.path,
      sha256: entry.sha256,
      size: entry.size,
    });
  }
  return entries;
}

/** Check the complete regular-file set, including the marker exactly once. */
export function assertCompleteInventory(value, archiveFiles) {
  const paths = assertOwnershipMarker(value).map(({ path: name }) => name);
  assert.equal(new Set(archiveFiles).size, archiveFiles.length);
  assert.deepEqual([...archiveFiles].sort(), [...paths, MARKER].sort());
}

/** Verify every declared digest and size against extracted regular-file bytes. */
export async function verifyOwnershipFiles(value, directory) {
  const entries = assertOwnershipMarker(value);
  for (const entry of entries) {
    const target = path.join(directory, entry.path);
    const stat = await fs.lstat(target);
    assert.ok(stat.isFile() && !stat.isSymbolicLink(), entry.path);
    const bytes = await fs.readFile(target);
    assert.equal(bytes.length, entry.size, entry.path);
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      entry.sha256,
      entry.path,
    );
  }
  return entries;
}

/** Read the installed public fixtures so missing or drifting package artifacts fail. */
export async function checkOwnershipFixtures(packageRoot) {
  const fixtures = JSON.parse(
    await fs.readFile(
      path.join(packageRoot, "docs/protocol/fixtures/export-ownership-v2.json"),
      "utf8",
    ),
  );
  assert.equal(fixtures.schemaVersion, 1);
  assert.ok(fixtures.cases.some(({ valid }) => valid === true));
  assert.ok(fixtures.cases.some(({ valid }) => valid === false));
  for (const sample of fixtures.cases) {
    assert.equal(typeof sample.valid, "boolean");
    const read = () => assertOwnershipMarker(sample.document);
    if (sample.valid) assert.doesNotThrow(read, sample.name);
    else
      assert.throws(
        read,
        (error) => error?.rejection === sample.rejection,
        sample.name,
      );
  }
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isOwnershipEntry(value) {
  return (
    isRecord(value) &&
    Object.hasOwn(value, "path") &&
    typeof value.path === "string" &&
    value.path !== MARKER &&
    Buffer.byteLength(value.path) <= MAX_PATH_BYTES &&
    Buffer.from(value.path).toString("utf8") === value.path &&
    !/\p{Cc}/u.test(value.path) &&
    !value.path.startsWith("/") &&
    !/[\\:]/.test(value.path) &&
    value.path
      .split("/")
      .every((segment) => segment && segment !== "." && segment !== "..") &&
    Object.hasOwn(value, "sha256") &&
    typeof value.sha256 === "string" &&
    SHA256.test(value.sha256) &&
    Object.hasOwn(value, "size") &&
    typeof value.size === "number" &&
    Number.isInteger(value.size) &&
    value.size >= 0 &&
    value.size <= MAX_FILE_BYTES
  );
}
