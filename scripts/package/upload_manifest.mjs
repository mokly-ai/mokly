import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const FIELDS = [
  "schemaVersion",
  "moklyVersion",
  "repository",
  "branch",
  "headSha",
  "uncommittedChanges",
  "baseRef",
  "baseSha",
  "pullRequest",
  "configPath",
  "exportedAt",
  "comparisonPath",
];
const GIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const COMPARISON_PATH =
  /^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/;
const SEMVER =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/** Validate every public upload manifest fixture with an independent reader. */
export async function checkUploadManifestFixtures(packageRoot) {
  const fixture = JSON.parse(
    await fs.readFile(
      path.join(packageRoot, "docs/protocol/fixtures/upload-manifest-v2.json"),
      "utf8",
    ),
  );
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(
    new Set(fixture.cases.map(({ name }) => name)).size,
    fixture.cases.length,
  );
  const states = new Set();
  for (const sample of fixture.cases) {
    const rejection = manifestRejection(sample.document);
    assert.equal(rejection === undefined, sample.valid, sample.name);
    if (sample.valid) states.add(sample.document.uncommittedChanges);
    else assert.equal(rejection, sample.rejection, sample.name);
  }
  assert.deepEqual([...states].sort(), [false, true]);
}

/** Classify one decoded manifest without importing package internals. */
function manifestRejection(value) {
  if (!record(value) || !Object.hasOwn(value, "schemaVersion"))
    return "invalid";
  if (value.schemaVersion !== 2) return "unsupported-version";
  const keys = Object.keys(value);
  if (
    keys.length !== FIELDS.length ||
    !FIELDS.every((field) => Object.hasOwn(value, field)) ||
    typeof value.uncommittedChanges !== "boolean" ||
    !repository(value.repository) ||
    !version(value.moklyVersion) ||
    !text(value.branch, 255) ||
    typeof value.headSha !== "string" ||
    !GIT_SHA.test(value.headSha) ||
    !portablePath(value.configPath) ||
    !timestamp(value.exportedAt) ||
    !(
      value.pullRequest === null ||
      (Number.isSafeInteger(value.pullRequest) && value.pullRequest > 0)
    ) ||
    !comparison(value)
  )
    return "invalid";
  return undefined;
}

function comparison(value) {
  if (value.comparisonPath === null)
    return value.baseRef === null && value.baseSha === null;
  return (
    text(value.baseRef, 255) &&
    typeof value.baseSha === "string" &&
    GIT_SHA.test(value.baseSha) &&
    typeof value.comparisonPath === "string" &&
    COMPARISON_PATH.test(value.comparisonPath)
  );
}

function repository(value) {
  return (
    record(value) &&
    Object.keys(value).length === 3 &&
    text(value.host, 253) &&
    value.host
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) &&
    text(value.owner, 255) &&
    value.owner.split("/").every(segment) &&
    text(value.name, 255) &&
    segment(value.name)
  );
}

function version(value) {
  const match = text(value, 255) ? SEMVER.exec(value) : null;
  return (
    !!match &&
    (match[4]?.split(".").every((part) => !/^0\d+$/.test(part)) ?? true)
  );
}

function portablePath(value) {
  return (
    text(value, 1024) &&
    !value.startsWith("/") &&
    !/[\\:]/.test(value) &&
    value.split("/").every((part) => part && part !== "." && part !== "..")
  );
}

function timestamp(value) {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function segment(value) {
  return /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== "..";
}

function text(value, bytes) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value) <= bytes &&
    !/\p{Cc}/u.test(value)
  );
}

function record(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
