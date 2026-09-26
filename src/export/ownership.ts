import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";
import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { exportError } from "./error.js";

/** Public-safe proof that a directory was installed by the exporter. */
export const EXPORT_MARKER = ".mokly-export-artifact";

const MAX_EXPORT_FILE_BYTES = 64 * 1024 * 1024;
const MAX_EXPORT_PATH_BYTES = 1024;
const SHA256 = /^[a-f0-9]{64}$/;

/** Digest and byte-size record for one exporter-owned regular file. */
export interface ExportOwnershipEntry {
  path: string;
  sha256: string;
  size: number;
}

/** Versioned list of files the exporter is allowed to replace. */
export interface ExportOwnership {
  schemaVersion: 2;
  files: readonly ExportOwnershipEntry[];
}

/** Stable rejection classes shared with the public compatibility fixture. */
export type ExportOwnershipRejection = "unsupported-version" | "invalid";

/** Classified ownership parse result for local and receiver-facing validation. */
export type ExportOwnershipParseResult =
  | { kind: "valid"; value: ExportOwnership }
  | { kind: "unsupported-version" }
  | { kind: "invalid" };

/** Build the schema 2 inventory from the exact bytes that will be written. */
export function buildExportOwnership(
  files: ReadonlyMap<string, ReviewArtifactContent>,
): ExportOwnership {
  const entries = [...files.keys()].sort().map((name) => {
    if (!isOwnershipPath(name))
      throw exportError(
        "The export contains a file path that is not portable. Rename the file before exporting again.",
      );
    const content = files.get(name);
    if (content === undefined)
      throw exportError(`Export file disappeared before staging: ${name}.`);
    const bytes = Buffer.from(content);
    if (bytes.length > MAX_EXPORT_FILE_BYTES)
      throw exportError(
        `Export file is larger than 64 MiB: ${name}. Reduce it before exporting again.`,
      );
    return {
      path: name,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      size: bytes.length,
    };
  });
  return { schemaVersion: 2, files: entries };
}

/** Serialize a writer-owned marker and enforce its regular-file size ceiling. */
export function serializeExportOwnership(ownership: ExportOwnership): string {
  const content = `${JSON.stringify(ownership, null, 2)}\n`;
  if (Buffer.byteLength(content) > MAX_EXPORT_FILE_BYTES)
    throw exportError(
      "The export ownership file is larger than 64 MiB. Reduce the catalogue before exporting again.",
    );
  return content;
}

/** Existing names captured during inspection, never authority for recursive deletion. */
export interface ExportEntries {
  files: string[];
  directories: string[];
}

/** Explicit repository-adapter migration; never accepted by the public CLI. */
export interface LegacyExportOwnership {
  marker: string;
  contents: string;
  accepts(name: string): boolean;
}

/** Parse the marker without trusting any path as a deletion target. */
export function parseExportOwnership(
  content: string,
): ExportOwnershipParseResult {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return { kind: "invalid" };
  }
  if (!isRecord(value) || !Object.hasOwn(value, "schemaVersion"))
    return { kind: "invalid" };
  if (value.schemaVersion !== 2) return { kind: "unsupported-version" };
  if (!Object.hasOwn(value, "files") || !Array.isArray(value.files))
    return { kind: "invalid" };
  const entries: ExportOwnershipEntry[] = [];
  const paths = new Set<string>();
  for (const entry of value.files) {
    if (!isOwnershipEntry(entry)) return { kind: "invalid" };
    const folded = entry.path.toLowerCase();
    if (paths.has(folded)) return { kind: "invalid" };
    paths.add(folded);
    entries.push({
      path: entry.path,
      sha256: entry.sha256,
      size: entry.size,
    });
  }
  return { kind: "valid", value: { schemaVersion: 2, files: entries } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function isOwnershipEntry(value: unknown): value is ExportOwnershipEntry {
  if (
    !isRecord(value) ||
    !Object.hasOwn(value, "path") ||
    !Object.hasOwn(value, "sha256") ||
    !Object.hasOwn(value, "size")
  )
    return false;
  return (
    typeof value.path === "string" &&
    value.path !== EXPORT_MARKER &&
    isOwnershipPath(value.path) &&
    typeof value.sha256 === "string" &&
    SHA256.test(value.sha256) &&
    typeof value.size === "number" &&
    Number.isInteger(value.size) &&
    value.size >= 0 &&
    value.size <= MAX_EXPORT_FILE_BYTES
  );
}

function isOwnershipPath(value: string): boolean {
  return (
    Buffer.byteLength(value) <= MAX_EXPORT_PATH_BYTES &&
    Buffer.from(value).toString("utf8") === value &&
    !/\p{Cc}/u.test(value) &&
    isSafeRepositoryPath(value)
  );
}

/** Enumerate a real directory and reject symlinks or special filesystem entries. */
export async function ownedEntries(
  root: string,
  prefix = "",
): Promise<ExportEntries> {
  const files: string[] = [];
  const directories: string[] = [];
  for (const entry of await fs.promises.readdir(root, {
    withFileTypes: true,
  })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      directories.push(name);
      const nested = await ownedEntries(
        path.join(root, entry.name),
        `${name}/`,
      );
      files.push(...nested.files);
      directories.push(...nested.directories);
    } else if (entry.isFile()) files.push(name);
    else
      throw exportError(
        `Export ownership contains a symlink or special entry: ${name}`,
      );
  }
  return { files: files.sort(), directories: directories.sort() };
}

/** Validate ownership and return the exact existing names authorized for cleanup. */
export async function assertExportOwnership(
  output: string,
  legacy?: LegacyExportOwnership,
): Promise<ExportEntries | undefined> {
  const stat = await fs.promises
    .lstat(output)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
  if (!stat) return;
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw exportError("Export ownership requires a real directory.");
  const { files, directories } = await ownedEntries(output);
  if (files.length === 0 && directories.length === 0)
    return { files, directories };
  if (
    legacy &&
    !files.includes(EXPORT_MARKER) &&
    files.includes(legacy.marker)
  ) {
    const valid = await fs.promises.readFile(
      path.join(output, legacy.marker),
      "utf8",
    );
    if (
      valid === legacy.contents &&
      files.every((name) => name === legacy.marker || legacy.accepts(name)) &&
      directories.every((name) =>
        files.some((file) => file.startsWith(`${name}/`)),
      )
    )
      return { files, directories };
    throw exportError(
      "Invalid legacy export ownership or unowned preview contents.",
    );
  }
  if (!files.includes(EXPORT_MARKER))
    throw exportError(
      "Export ownership is missing; choose an empty directory.",
    );
  const parsed = parseExportOwnership(
    await fs.promises.readFile(path.join(output, EXPORT_MARKER), "utf8"),
  );
  if (parsed.kind === "unsupported-version")
    throw exportError(
      `This export was created by an unsupported Mokly version. Remove ${output} before exporting again.`,
    );
  if (parsed.kind === "invalid")
    throw exportError("Invalid export ownership inventory.");
  const paths = parsed.value.files.map(({ path: name }) => name);
  const allowed = new Set([...paths, EXPORT_MARKER]);
  if (
    files.some((name) => !allowed.has(name)) ||
    directories.some(
      (name) => !paths.some((file) => file.startsWith(`${name}/`)),
    )
  )
    throw exportError(
      "Export output contains unowned files or directories; move them before exporting.",
    );
  return { files, directories };
}
