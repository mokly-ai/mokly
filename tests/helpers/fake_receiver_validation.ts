import crypto from "node:crypto";

import { parseReviewResult } from "@mokly/viewer/data";

import {
  type ExportOwnership,
  type ExportOwnershipEntry,
} from "../../dist/export/ownership.js";
import type { UploadManifest } from "../../dist/publish/types.js";

import {
  FakeReceiverRejection,
  readFakePlanArchive,
} from "./fake_receiver_archive.js";
import {
  readFakeOwnership,
  readFakeUploadManifest,
} from "./fake_receiver_documents.js";
import { parseUniqueJson } from "./fake_receiver_json.js";

const EXPORT_MARKER = ".mokly-export-artifact";
const UPLOAD_MANIFEST = "mokly-upload.json";

/** Fully validated plan archive used by the fake receiver state machine. */
export interface ValidatedFakePlan {
  files: Map<string, Buffer>;
  manifest: UploadManifest;
  ownership: ExportOwnership;
  entriesByDigest: Map<string, ExportOwnershipEntry>;
}

/** Validate the documented plan archive and its cross-file references. */
export async function validateFakePlanArchive(
  archive: Buffer,
): Promise<ValidatedFakePlan> {
  const files = await readFakePlanArchive(archive);
  const manifestBytes = files.get(UPLOAD_MANIFEST);
  const markerBytes = files.get(EXPORT_MARKER);
  if (!manifestBytes || !markerBytes) throw invalid();
  if (manifestBytes.length > 16 * 1024) throw tooLarge();
  const manifest = readFakeUploadManifest(uniqueDocument(manifestBytes));
  const ownership = readFakeOwnership(uniqueDocument(markerBytes));
  if (ownership.files.length + 1 > 20_000) throw tooLarge();
  const expected = new Set([
    UPLOAD_MANIFEST,
    EXPORT_MARKER,
    ...(manifest.comparisonPath ? [manifest.comparisonPath] : []),
  ]);
  if (
    files.size !== expected.size ||
    [...files].some(([name]) => !expected.has(name))
  )
    throw invalid();
  const byPath = new Map(ownership.files.map((entry) => [entry.path, entry]));
  for (const required of ["index.html", "404.html", UPLOAD_MANIFEST])
    if (!byPath.has(required)) throw invalid();
  assertNoPrefixCollisions(ownership.files);
  assertArchivedEntry(byPath.get(UPLOAD_MANIFEST), manifestBytes);
  if (manifest.comparisonPath) {
    const reviewBytes = files.get(manifest.comparisonPath);
    if (!reviewBytes) throw invalid();
    assertArchivedEntry(byPath.get(manifest.comparisonPath), reviewBytes);
    try {
      const review = parseReviewResult(uniqueDocument(reviewBytes));
      if (
        review.baseRef !== manifest.baseRef ||
        review.baseCommit !== manifest.baseSha
      )
        throw invalid();
    } catch {
      throw invalid();
    }
  }
  const entriesByDigest = new Map<string, ExportOwnershipEntry>();
  for (const entry of ownership.files) {
    const previous = entriesByDigest.get(entry.sha256);
    if (previous && previous.size !== entry.size) throw invalid();
    entriesByDigest.set(entry.sha256, entry);
  }
  return {
    files,
    manifest,
    ownership,
    entriesByDigest,
  };
}

function uniqueDocument(bytes: Buffer): unknown {
  try {
    const source = bytes.toString("utf8");
    if (
      source.charCodeAt(0) === 0xfeff ||
      !Buffer.from(source, "utf8").equals(bytes)
    )
      throw new SyntaxError("invalid UTF-8 JSON");
    return parseUniqueJson(source);
  } catch {
    throw invalid();
  }
}

function assertArchivedEntry(
  entry: ExportOwnershipEntry | undefined,
  bytes: Buffer,
): void {
  if (
    !entry ||
    entry.size !== bytes.length ||
    crypto.createHash("sha256").update(bytes).digest("hex") !== entry.sha256
  )
    throw invalid();
}

function assertNoPrefixCollisions(
  entries: readonly ExportOwnershipEntry[],
): void {
  const paths = new Set(entries.map(({ path }) => path.toLowerCase()));
  for (const entry of entries) {
    const parts = entry.path.toLowerCase().split("/");
    parts.pop();
    while (parts.length > 0) {
      if (paths.has(parts.join("/"))) throw invalid();
      parts.pop();
    }
  }
}

function invalid(): FakeReceiverRejection {
  return new FakeReceiverRejection(400);
}

function tooLarge(): FakeReceiverRejection {
  return new FakeReceiverRejection(413);
}
