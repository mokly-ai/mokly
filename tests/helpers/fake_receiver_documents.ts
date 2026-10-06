import type {
  ExportOwnership,
  ExportOwnershipEntry,
} from "../../packages/mokly/dist/export/ownership.js";
import type { UploadManifest } from "../../packages/mokly/dist/publish/types.js";

import { FakeReceiverRejection } from "./fake_receiver_archive.js";

const MARKER = ".mokly-export-artifact";
const SHA256 = /^[a-f0-9]{64}$/;
const GIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;
const MANIFEST_FIELDS = [
  "schemaVersion",
  "moklyVersion",
  "repository",
  "branch",
  "headSha",
  "baseRef",
  "baseSha",
  "pullRequest",
  "configPath",
  "exportedAt",
  "comparisonPath",
];

/** Independently validate an upload manifest received in the plan archive. */
export function readFakeUploadManifest(value: unknown): UploadManifest {
  if (!record(value) || !Object.hasOwn(value, "schemaVersion")) throw invalid();
  if (value["schemaVersion"] !== 1) throw unsupported();
  if (!exactKeys(value, MANIFEST_FIELDS)) throw invalid();
  const repository = value["repository"];
  if (
    !record(repository) ||
    !exactKeys(repository, ["host", "owner", "name"]) ||
    !repositoryHost(repository["host"]) ||
    !boundedText(repository["owner"], 255) ||
    !repository["owner"].split("/").every(repositorySegment) ||
    !boundedText(repository["name"], 255) ||
    !repositorySegment(repository["name"])
  )
    throw invalid();
  if (
    !exactVersion(value["moklyVersion"]) ||
    !boundedText(value["branch"], 255) ||
    typeof value["headSha"] !== "string" ||
    !GIT_SHA.test(value["headSha"]) ||
    !safePath(value["configPath"]) ||
    !timestamp(value["exportedAt"])
  )
    throw invalid();
  const pullRequest = value["pullRequest"];
  if (
    pullRequest !== null &&
    (typeof pullRequest !== "number" ||
      !Number.isSafeInteger(pullRequest) ||
      pullRequest < 1)
  )
    throw invalid();
  if (value["comparisonPath"] === null) {
    if (value["baseRef"] !== null || value["baseSha"] !== null) throw invalid();
  } else if (
    !boundedText(value["baseRef"], 255) ||
    typeof value["baseSha"] !== "string" ||
    !GIT_SHA.test(value["baseSha"]) ||
    typeof value["comparisonPath"] !== "string" ||
    !/^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/u.test(
      value["comparisonPath"],
    )
  )
    throw invalid();
  return value as unknown as UploadManifest;
}

/** Independently validate the schema 2 ownership marker received at Plan. */
export function readFakeOwnership(value: unknown): ExportOwnership {
  if (!record(value) || !Object.hasOwn(value, "schemaVersion")) throw invalid();
  if (value["schemaVersion"] !== 2) throw unsupported();
  if (!Array.isArray(value["files"])) throw invalid();
  const files: ExportOwnershipEntry[] = [];
  const paths = [MARKER.toLowerCase()];
  for (const candidate of value["files"]) {
    const rejection = ownershipEntryRejection(candidate);
    if (rejection === "too-large") throw tooLarge();
    if (rejection === "invalid") throw invalid();
    paths.push(candidate.path.toLowerCase());
    files.push({
      path: candidate.path,
      sha256: candidate.sha256,
      size: candidate.size,
    });
  }
  const unique = new Set(paths);
  if (unique.size !== paths.length) throw invalid();
  for (const name of unique) {
    const parts = name.split("/");
    parts.pop();
    while (parts.length > 0) {
      if (unique.has(parts.join("/"))) throw invalid();
      parts.pop();
    }
  }
  return { schemaVersion: 2, files };
}

function ownershipEntryRejection(
  value: unknown,
): "invalid" | "too-large" | undefined {
  if (
    !record(value) ||
    !Object.hasOwn(value, "path") ||
    !Object.hasOwn(value, "sha256") ||
    !Object.hasOwn(value, "size") ||
    typeof value["path"] !== "string" ||
    typeof value["sha256"] !== "string" ||
    typeof value["size"] !== "number" ||
    !Number.isInteger(value["size"])
  )
    return "invalid";
  if (
    Buffer.byteLength(value["path"]) > 1024 ||
    value["size"] > 64 * 1024 * 1024
  )
    return "too-large";
  return value["path"] !== MARKER &&
    safePath(value["path"]) &&
    SHA256.test(value["sha256"]) &&
    value["size"] >= 0
    ? undefined
    : "invalid";
}

function safePath(value: unknown): value is string {
  return (
    boundedText(value, 1024) &&
    !value.startsWith("/") &&
    !/[\\:]/u.test(value) &&
    value
      .split("/")
      .every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

function exactVersion(value: unknown): value is string {
  if (!boundedText(value, 255)) return false;
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u.exec(
      value,
    );
  return (
    !!match &&
    (match[4]?.split(".").every((part) => !/^0\d+$/u.test(part)) ?? true)
  );
}

function timestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function boundedText(value: unknown, bytes: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value) <= bytes &&
    Buffer.from(value).toString("utf8") === value &&
    !/\p{Cc}/u.test(value)
  );
}

function repositoryHost(value: unknown): value is string {
  return (
    boundedText(value, 253) &&
    value
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))
  );
}

function repositorySegment(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/u.test(value) && value !== "." && value !== "..";
}

function exactKeys(
  value: Record<string, unknown>,
  names: readonly string[],
): boolean {
  return (
    Object.keys(value).length === names.length &&
    names.every((name) => Object.hasOwn(value, name))
  );
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function invalid(): FakeReceiverRejection {
  return new FakeReceiverRejection(400);
}

function unsupported(): FakeReceiverRejection {
  return new FakeReceiverRejection(426);
}

function tooLarge(): FakeReceiverRejection {
  return new FakeReceiverRejection(413);
}
