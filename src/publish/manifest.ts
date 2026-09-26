import { MoklyError } from "../errors.js";

import type { UploadManifest } from "./types.js";
import {
  boundedText,
  exactVersion,
  GIT_SHA,
  repositoryHost,
  repositorySegment,
  uploadTimestamp,
  uploadPath,
} from "./validation.js";

/** Stable archive-root name; included in the export ownership inventory. */
export const UPLOAD_MANIFEST = "mokly-upload.json";

const FIELDS = [
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

/** Validate the generated v1 envelope before it enters the export snapshot. */
export function validateUploadManifest(value: unknown): UploadManifest {
  if (!record(value) || !keys(value, FIELDS)) throw invalid();
  if (value["schemaVersion"] !== 1)
    throw new MoklyError(
      "upload-unsupported-version",
      "Use a receiver and Mokly version that support upload v1.",
    );
  const repository = value["repository"];
  if (
    !record(repository) ||
    !keys(repository, ["host", "owner", "name"]) ||
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
    !uploadPath(value["configPath"])
  )
    throw invalid();
  if (!uploadTimestamp(value["exportedAt"])) throw invalid();
  const pr = value["pullRequest"];
  if (
    pr !== null &&
    (typeof pr !== "number" || !Number.isSafeInteger(pr) || pr < 1)
  )
    throw invalid();
  if (value["comparisonPath"] === null) {
    if (value["baseRef"] !== null || value["baseSha"] !== null) throw invalid();
  } else if (
    !boundedText(value["baseRef"], 255) ||
    typeof value["baseSha"] !== "string" ||
    !GIT_SHA.test(value["baseSha"]) ||
    typeof value["comparisonPath"] !== "string" ||
    !/^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(
      value["comparisonPath"],
    )
  )
    throw invalid();
  if (Buffer.byteLength(JSON.stringify(value)) > 16 * 1024)
    throw new MoklyError(
      "upload-too-large",
      "The upload manifest exceeds 16 KiB.",
    );
  return value as unknown as UploadManifest;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function keys(
  value: Record<string, unknown>,
  fields: readonly string[],
): boolean {
  return (
    Object.keys(value).length === fields.length &&
    fields.every((name) => Object.hasOwn(value, name))
  );
}

function invalid(): MoklyError {
  return new MoklyError(
    "upload-invalid-bundle",
    "Upload metadata is invalid; check repository, revision and config paths.",
  );
}
