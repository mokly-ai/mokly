import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const SHA256 = /^[a-f0-9]{64}$/;
const PLACEHOLDER = "{sha256}";
const PROBE = "a".repeat(64);

/** Validate every public plan and Complete fixture with an independent reader. */
export async function checkUploadPlanFixtures(packageRoot) {
  const fixture = JSON.parse(
    await fs.readFile(
      path.join(packageRoot, "docs/protocol/fixtures/upload-plan-v1.json"),
      "utf8",
    ),
  );
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(
    new Set(fixture.cases.map(({ name }) => name)).size,
    fixture.cases.length,
  );
  for (const sample of fixture.cases) {
    if ((sample.step ?? "plan") === "complete") {
      const result = completeOutcome(sample);
      assert.equal(result.outcome, sample.outcome, sample.name);
      assert.equal(result.viewerUrl, sample.viewerUrl, sample.name);
      continue;
    }
    let valid = true;
    try {
      const value = decodedJson(sample);
      if ((sample.status ?? 200) !== 200) throw new Error("plan status");
      assertPlanResponse(value, fixture.endpoint, new Set(fixture.marker));
    } catch {
      valid = false;
    }
    assert.equal(valid, sample.valid, sample.name);
  }
}

/** Validate one decoded plan response without importing package internals. */
export function assertPlanResponse(value, endpoint, marker) {
  if (!record(value) || value.schemaVersion !== 1 || !record(value.upload))
    throw new Error("invalid plan");
  if (
    !opaqueId(value.upload.id) ||
    !timestamp(value.upload.expiresAt) ||
    !Array.isArray(value.missing)
  )
    throw new Error("invalid plan");
  let previous;
  for (const digest of value.missing) {
    if (
      typeof digest !== "string" ||
      !SHA256.test(digest) ||
      !marker.has(digest) ||
      (previous !== undefined && previous >= digest)
    )
      throw new Error("invalid missing digest");
    previous = digest;
  }
  if (
    typeof value.blobUrl !== "string" ||
    !blobUrl(value.blobUrl, endpoint) ||
    typeof value.completeUrl !== "string" ||
    !sameOrigin(value.completeUrl, endpoint)
  )
    throw new Error("invalid plan URL");
  return value;
}

function completeOutcome(sample) {
  const status = sample.status ?? 200;
  if (status === 409 || status === 410)
    return { outcome: "replan", viewerUrl: null };
  if ([408, 429, 500, 502, 503, 504].includes(status))
    return { outcome: "retry", viewerUrl: null };
  const category = new Map([
    [400, "upload-invalid-bundle"],
    [422, "upload-invalid-bundle"],
    [401, "upload-unauthorized"],
    [403, "upload-unauthorized"],
    [413, "upload-too-large"],
    [426, "upload-unsupported-version"],
  ]).get(status);
  if (status !== 200 && status !== 201)
    return { outcome: category ?? "upload-failed", viewerUrl: null };
  return {
    outcome: status === 201 ? "published" : "already-published",
    viewerUrl: viewerUrl(sample),
  };
}

function viewerUrl(sample) {
  try {
    if (mediaType(sample) !== "application/json") return null;
    const value = decodedJson(sample);
    if (!record(value) || typeof value.viewerUrl !== "string") return null;
    const url = new URL(value.viewerUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function decodedJson(sample) {
  if (mediaType(sample) !== "application/json")
    throw new Error("invalid media type");
  return JSON.parse(
    Object.hasOwn(sample, "document")
      ? JSON.stringify(sample.document)
      : (sample.body ?? ""),
  );
}

function mediaType(sample) {
  const contentType = Object.hasOwn(sample, "contentType")
    ? sample.contentType
    : "application/json";
  return typeof contentType === "string"
    ? contentType.split(";", 1)[0].trim().toLowerCase()
    : undefined;
}

function blobUrl(value, endpoint) {
  const first = value.indexOf(PLACEHOLDER);
  if (first < 0 || first !== value.lastIndexOf(PLACEHOLDER)) return false;
  const boundary = [value.indexOf("?"), value.indexOf("#")]
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  if (boundary !== undefined && first > boundary) return false;
  try {
    const url = new URL(value.replace(PLACEHOLDER, PROBE));
    return sameOrigin(url.href, endpoint) && url.pathname.includes(PROBE);
  } catch {
    return false;
  }
}

function sameOrigin(value, endpoint) {
  try {
    const url = new URL(value);
    return (
      !url.username && !url.password && url.origin === new URL(endpoint).origin
    );
  } catch {
    return false;
  }
}

function opaqueId(value) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value) <= 255 &&
    Buffer.from(value).toString("utf8") === value
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

function record(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
