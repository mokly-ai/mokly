import { isSafeRepositoryPath } from "@mokly/viewer/data";

/** Full Git SHA-1 or SHA-256 object id. */
export const GIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/;

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
  return boundedText(value, 1024) && isSafeRepositoryPath(value);
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
