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
  const paths = [MARKER.toLowerCase()];
  const entries = [];
  for (const entry of value.files) {
    const rejection = ownershipEntryRejection(entry);
    if (rejection) throw new OwnershipMarkerError(rejection);
    paths.push(entry.path.toLowerCase());
    entries.push({
      path: entry.path,
      sha256: entry.sha256,
      size: entry.size,
    });
  }
  const unique = new Set(paths);
  if (unique.size !== paths.length) throw new OwnershipMarkerError("invalid");
  for (const name of unique) {
    const parts = name.split("/");
    parts.pop();
    while (parts.length > 0) {
      if (unique.has(parts.join("/")))
        throw new OwnershipMarkerError("invalid");
      parts.pop();
    }
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

function ownershipEntryRejection(value) {
  if (
    !isRecord(value) ||
    !Object.hasOwn(value, "path") ||
    !Object.hasOwn(value, "sha256") ||
    !Object.hasOwn(value, "size") ||
    typeof value.path !== "string" ||
    typeof value.sha256 !== "string" ||
    typeof value.size !== "number" ||
    !Number.isInteger(value.size)
  )
    return "invalid";
  if (
    Buffer.byteLength(value.path) > MAX_PATH_BYTES ||
    value.size > MAX_FILE_BYTES
  )
    return "too-large";
  return value.path === MARKER ||
    Buffer.from(value.path).toString("utf8") !== value.path ||
    /\p{Cc}/u.test(value.path) ||
    value.path.startsWith("/") ||
    /[\\:]/u.test(value.path) ||
    value.path
      .split("/")
      .some(
        (segment) => segment === "" || segment === "." || segment === "..",
      ) ||
    !SHA256.test(value.sha256) ||
    value.size < 0
    ? "invalid"
    : undefined;
}
