import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const MARKER = ".mokly-export-artifact";

/** Independent marker-shape reader for package conformance, not a full receiver. */
function assertOwnershipMarker(value) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  assert.ok(
    Object.hasOwn(value, "schemaVersion") && Object.hasOwn(value, "files"),
  );
  assert.equal(value.schemaVersion, 1);
  assert.ok(Array.isArray(value.files));
  const seen = new Set();
  for (const file of value.files) {
    assert.equal(typeof file, "string");
    assert.ok(file !== MARKER && !/[\\:\0]/.test(file));
    assert.ok(
      file
        .split("/")
        .every((segment) => segment && segment !== "." && segment !== ".."),
    );
    assert.equal(seen.has(file.toLowerCase()), false);
    seen.add(file.toLowerCase());
  }
  return [...value.files];
}

/** Check the complete regular-file set, including the marker exactly once. */
export function assertCompleteInventory(value, archiveFiles) {
  const files = assertOwnershipMarker(value);
  assert.deepEqual([...archiveFiles].sort(), [...files, MARKER].sort());
}

/** Read the installed public fixtures so missing or drifting package artifacts fail. */
export async function checkOwnershipFixtures(packageRoot) {
  const fixtures = JSON.parse(
    await fs.readFile(
      path.join(packageRoot, "docs/protocol/fixtures/export-ownership-v1.json"),
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
    else assert.throws(read, sample.name);
  }
}
