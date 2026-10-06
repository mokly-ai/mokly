import {
  invalidBundle,
  unsupportedUploadVersion,
  uploadTooLarge,
} from "./errors.js";
import type { UploadManifest } from "./types.js";
import {
  boundedText,
  exactVersion,
  GIT_SHA,
  isRecord,
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
  "uncommittedChanges",
  "baseRef",
  "baseSha",
  "pullRequest",
  "configPath",
  "exportedAt",
  "comparisonPath",
];
const INVALID_MANIFEST_MESSAGE =
  "Upload metadata is invalid; check repository, revision and config paths.";

/** Validate the generated v2 envelope before it enters the export snapshot. */
export function validateUploadManifest(value: unknown): UploadManifest {
  if (!isRecord(value) || !Object.hasOwn(value, "schemaVersion"))
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  if (value["schemaVersion"] !== 2)
    throw unsupportedUploadVersion(
      "Use a receiver and Mokly version that support upload v2.",
    );
  if (!keys(value, FIELDS) || typeof value["uncommittedChanges"] !== "boolean")
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  const repository = value["repository"];
  if (
    !isRecord(repository) ||
    !keys(repository, ["host", "owner", "name"]) ||
    !repositoryHost(repository["host"]) ||
    !boundedText(repository["owner"], 255) ||
    !repository["owner"].split("/").every(repositorySegment) ||
    !boundedText(repository["name"], 255) ||
    !repositorySegment(repository["name"])
  )
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  if (
    !exactVersion(value["moklyVersion"]) ||
    !boundedText(value["branch"], 255) ||
    typeof value["headSha"] !== "string" ||
    !GIT_SHA.test(value["headSha"]) ||
    !uploadPath(value["configPath"])
  )
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  if (!uploadTimestamp(value["exportedAt"]))
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  const pr = value["pullRequest"];
  if (
    pr !== null &&
    (typeof pr !== "number" || !Number.isSafeInteger(pr) || pr < 1)
  )
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  if (value["comparisonPath"] === null) {
    if (value["baseRef"] !== null || value["baseSha"] !== null)
      throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  } else if (
    !boundedText(value["baseRef"], 255) ||
    typeof value["baseSha"] !== "string" ||
    !GIT_SHA.test(value["baseSha"]) ||
    typeof value["comparisonPath"] !== "string" ||
    !/^__mokly\/diffs\/__generations\/[a-f0-9]{64}\/review\.json$/.test(
      value["comparisonPath"],
    )
  )
    throw invalidBundle(INVALID_MANIFEST_MESSAGE);
  if (Buffer.byteLength(JSON.stringify(value)) > 16 * 1024)
    throw uploadTooLarge("The upload manifest exceeds 16 KiB.");
  return value as unknown as UploadManifest;
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
