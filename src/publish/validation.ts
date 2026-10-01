import { classifyPortableExportPath } from "../export/portable_path.js";

/** Full Git SHA-1 or SHA-256 object id. */
export const GIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

/** True for a non-null JSON-style object rather than an array. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Exact UTC millisecond timestamp used by upload envelopes and plans. */
export function uploadTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

/** Nonempty bounded UTF-8 metadata with no control characters. */
export function boundedText(value: unknown, bytes: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value) <= bytes &&
    Buffer.from(value).toString("utf8") === value &&
    !/\p{Cc}/u.test(value)
  );
}

/** Safe portable archive/config path; paths never authorize filesystem access. */
export function uploadPath(value: unknown): value is string {
  return classifyPortableExportPath(value) === "valid";
}

/** Parse an absolute same-endpoint HTTP(S) request URL without userinfo. */
export function uploadRequestUrl(
  value: string,
  endpoint: string,
): URL | undefined {
  try {
    const candidate = new URL(value);
    const configured = new URL(endpoint);
    if (
      !["http:", "https:"].includes(candidate.protocol) ||
      candidate.protocol !== configured.protocol ||
      candidate.hostname !== configured.hostname ||
      candidate.port !== configured.port ||
      candidate.username ||
      candidate.password
    )
      return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}

/** Exact SemVer release, including numeric prerelease identifier restrictions. */
export function exactVersion(value: unknown): value is string {
  if (!boundedText(value, 255)) return false;
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(
      value,
    );
  return (
    !!match &&
    (match[4]?.split(".").every((part) => !/^0\d+$/.test(part)) ?? true)
  );
}

/** Repository path segment grammar shared by detected and declared identities. */
export function repositorySegment(value: string): boolean {
  return /^[A-Za-z0-9._-]+$/.test(value) && value !== "." && value !== "..";
}

/** Lowercase DNS/IPv4 host without credentials or a port. */
export function repositoryHost(value: unknown): value is string {
  return (
    boundedText(value, 253) &&
    value
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))
  );
}
