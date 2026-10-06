import type { Principal } from "./auth.js";
import { CacheError } from "./errors.js";
import type { ArtifactDescriptor, ArtifactMetadata } from "./store.js";

export const ARTIFACT_LIMIT = 100_000_000;
export const JSON_LIMIT = 1_048_576;
export const ARRAY_LIMIT = 1_024;

export function validateHash(value: string): string {
  if (!/^[a-fA-F0-9]{1,128}$/u.test(value))
    throw new CacheError(400, "bad_request", "Invalid artifact hash.");
  return value;
}

export function requireMediaType(headers: Headers, expected: string): void {
  if (
    headers.get("Content-Type")?.split(";")[0]?.trim().toLowerCase() !==
    expected
  )
    throw new CacheError(
      415,
      "unsupported_media_type",
      "Unsupported cache media type.",
    );
}

export function contentLength(
  headers: Headers,
  limit: number,
  required: boolean,
): number | undefined {
  const value = headers.get("Content-Length");
  if (value === null && !required) return undefined;
  const length = value !== null && /^\d+$/u.test(value) ? Number(value) : NaN;
  if (!Number.isSafeInteger(length) || length < 0)
    throw new CacheError(400, "bad_request", "Invalid Content-Length.");
  if (length > limit)
    throw new CacheError(413, "too_large", "Cache request is too large.");
  return length;
}

export function duration(value: string): string {
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value)))
    throw new CacheError(400, "bad_request", "Invalid artifact duration.");
  return value;
}

export function uploadMetadata(
  headers: Headers,
  principal: Principal,
): ArtifactMetadata {
  const metadata: ArtifactMetadata = {
    duration: duration(headers.get("x-artifact-duration") ?? "0"),
    principal,
  };
  const tag = headers.get("x-artifact-tag");
  if (tag !== null) {
    if (tag.length > 600)
      throw new CacheError(400, "bad_request", "Invalid artifact tag.");
    metadata.tag = tag;
  }
  for (const [header, field] of [
    ["x-artifact-sha", "sha"],
    ["x-artifact-dirty-hash", "dirtyHash"],
  ] as const) {
    const value = headers.get(header);
    if (value !== null && /^[a-fA-F0-9]{1,128}$/u.test(value))
      metadata[field] = value;
  }
  return metadata;
}

export function artifactHeaders(artifact: ArtifactDescriptor): Headers {
  const headers = new Headers({
    "Content-Type": "application/octet-stream",
    "Content-Length": String(artifact.size),
    "x-artifact-duration": artifact.metadata.duration,
    "Cache-Control": "private, no-store",
  });
  for (const [field, header] of [
    ["tag", "x-artifact-tag"],
    ["sha", "x-artifact-sha"],
    ["dirtyHash", "x-artifact-dirty-hash"],
  ] as const) {
    const value = artifact.metadata[field];
    if (value !== undefined) headers.set(header, value);
  }
  return headers;
}
