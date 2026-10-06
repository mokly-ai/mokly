import {
  EXPORT_MARKER,
  parseExportOwnership,
  type ExportOwnership,
} from "../export/ownership.js";

import type { UploadBlob } from "./blobs.js";
import { validateUploadFiles } from "./bundle.js";
import {
  invalidBundle,
  unsupportedUploadVersion,
  uploadTooLarge,
} from "./errors.js";
import { UPLOAD_MANIFEST, validateUploadManifest } from "./manifest.js";
import type { UploadManifest } from "./types.js";

/** Fully validated immutable-byte input to the publication exchange. */
export interface UploadSnapshot {
  files: Map<string, Buffer>;
  manifest: UploadManifest;
  ownership: ExportOwnership;
  blobs: Map<string, UploadBlob>;
}

/** Validate finalized export bytes and index their content-addressed blobs. */
export function readUploadSnapshot(
  contents: ReadonlyMap<string, string | Uint8Array>,
): UploadSnapshot {
  const files = validateUploadFiles(contents);
  const markerBytes = files.get(EXPORT_MARKER);
  if (!markerBytes)
    throw invalidBundle("The export ownership marker is missing.");
  const parsed = parseExportOwnership(markerBytes.toString("utf8"));
  if (parsed.kind === "unsupported-version")
    throw unsupportedUploadVersion(
      "The export ownership version is not supported for publication.",
    );
  if (parsed.kind === "invalid")
    throw invalidBundle("The export ownership marker is invalid.");
  if (parsed.kind === "too-large")
    throw uploadTooLarge(
      "The export ownership marker exceeds an upload limit.",
    );
  if (parsed.value.files.length + 1 !== files.size)
    throw invalidBundle("The export ownership inventory is incomplete.");
  const blobs = new Map<string, UploadBlob>();
  const ownedPaths = new Set<string>();
  for (const entry of parsed.value.files) {
    ownedPaths.add(entry.path);
    const bytes = files.get(entry.path);
    if (!bytes || bytes.length !== entry.size)
      throw invalidBundle("The export does not match its ownership inventory.");
    const previous = blobs.get(entry.sha256);
    if (
      previous &&
      (previous.size !== entry.size || !previous.bytes.equals(bytes))
    )
      throw invalidBundle("The export has conflicting content digests.");
    blobs.set(entry.sha256, { ...entry, bytes });
  }
  for (const name of files.keys()) {
    if (name !== EXPORT_MARKER && !ownedPaths.has(name))
      throw invalidBundle("The export ownership inventory is incomplete.");
  }
  const manifestBytes = files.get(UPLOAD_MANIFEST);
  if (!manifestBytes) throw invalidBundle("The upload manifest is missing.");
  let manifestValue: unknown;
  try {
    manifestValue = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw invalidBundle("The upload manifest is invalid.");
  }
  return {
    files,
    manifest: validateUploadManifest(manifestValue),
    ownership: parsed.value,
    blobs,
  };
}
