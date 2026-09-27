import { exportError } from "./error.js";

/** Maximum UTF-8 length of every exported relative file path. */
export const MAX_EXPORT_PATH_BYTES = 1024;

/** Stable classification shared by export, ownership and upload validation. */
export type PortableExportPathKind = "valid" | "too-large" | "invalid";

/** Classify one value against the complete export-path portability rule. */
export function classifyPortableExportPath(
  value: unknown,
): PortableExportPathKind {
  if (typeof value !== "string") return "invalid";
  if (Buffer.byteLength(value) > MAX_EXPORT_PATH_BYTES) return "too-large";
  if (
    value.length === 0 ||
    Buffer.from(value).toString("utf8") !== value ||
    /\p{Cc}/u.test(value) ||
    value.startsWith("/") ||
    /[\\:]/u.test(value) ||
    value
      .split("/")
      .some((segment) => segment === "" || segment === "." || segment === "..")
  )
    return "invalid";
  return "valid";
}

/** Reject a non-portable export path with escaped, actionable product copy. */
export function assertPortableExportPath(value: string): void {
  if (classifyPortableExportPath(value) !== "valid")
    throw exportError(
      `The export path ${displayPath(value)} is not portable. Rename that file or folder, then export again.`,
    );
}

function displayPath(value: string): string {
  return JSON.stringify(value).replace(/\p{Cc}/gu, (character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return `\\u${codePoint.toString(16).padStart(4, "0")}`;
  });
}
