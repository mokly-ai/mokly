import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ReviewArtifactContent } from "@mokly/viewer/data";

import { exportError } from "./error.js";
import {
  assertPortableExportPath,
  classifyPortableExportPath,
} from "./portable_path.js";

/** Public-safe proof that a directory was installed by the exporter. */
export const EXPORT_MARKER = ".mokly-export-artifact";

const MAX_EXPORT_FILE_BYTES = 64 * 1024 * 1024;
const SHA256 = /^[a-f0-9]{64}$/;

/** Digest and byte-size record for one exporter-owned regular file. */
export interface ExportOwnershipEntry {
  path: string;
  sha256: string;
  size: number;
}

/** Versioned list of files the exporter is allowed to replace. */
export interface ExportOwnership {
  schemaVersion: 3;
  files: readonly ExportOwnershipEntry[];
}

/** Stable rejection classes shared with the public compatibility fixture. */
export type ExportOwnershipRejection =
  "unsupported-version" | "too-large" | "invalid";

/** Classified ownership parse result for local and receiver-facing validation. */
export type ExportOwnershipParseResult =
  | { kind: "valid"; value: ExportOwnership }
  | { kind: "unsupported-version"; version: unknown }
  | { kind: "too-large" }
  | { kind: "invalid" };

/** Build the schema 3 inventory from the exact bytes that will be written. */
export function buildExportOwnership(
  files: ReadonlyMap<string, ReviewArtifactContent>,
): ExportOwnership {
  const entries = [...files.keys()].sort().map((name) => {
    assertPortableExportPath(name);
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
  return { schemaVersion: 3, files: entries };
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
  if (value.schemaVersion !== 3)
    return { kind: "unsupported-version", version: value.schemaVersion };
  if (!Object.hasOwn(value, "files") || !Array.isArray(value.files))
    return { kind: "invalid" };
  const entries: ExportOwnershipEntry[] = [];
  const paths = [EXPORT_MARKER.toLowerCase()];
  for (const entry of value.files) {
    const parsed = parseOwnershipEntry(entry);
    if (parsed.kind !== "valid") return parsed;
    paths.push(parsed.value.path.toLowerCase());
    entries.push(parsed.value);
  }
  const unique = new Set(paths);
  if (unique.size !== paths.length) return { kind: "invalid" };
  for (const name of unique) {
    const parts = name.split("/");
    parts.pop();
    while (parts.length > 0) {
      if (unique.has(parts.join("/"))) return { kind: "invalid" };
      parts.pop();
    }
  }
  return { kind: "valid", value: { schemaVersion: 3, files: entries } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseOwnershipEntry(
  value: unknown,
):
  | { kind: "valid"; value: ExportOwnershipEntry }
  | { kind: "too-large" | "invalid" } {
  if (
    !isRecord(value) ||
    !Object.hasOwn(value, "path") ||
    !Object.hasOwn(value, "sha256") ||
    !Object.hasOwn(value, "size")
  )
    return { kind: "invalid" };
  if (
    typeof value.path !== "string" ||
    typeof value.sha256 !== "string" ||
    typeof value.size !== "number" ||
    !Number.isInteger(value.size)
  )
    return { kind: "invalid" };
  const pathKind = classifyPortableExportPath(value.path);
  if (pathKind === "too-large" || value.size > MAX_EXPORT_FILE_BYTES)
    return { kind: "too-large" };
  if (
    pathKind !== "valid" ||
    value.path === EXPORT_MARKER ||
    !SHA256.test(value.sha256) ||
    value.size < 0
  )
    return { kind: "invalid" };
  return {
    kind: "valid",
    value: {
      path: value.path,
      sha256: value.sha256,
      size: value.size,
    },
  };
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
        `Export ownership contains a symlink or special entry: ${root} (${name})`,
      );
  }
  return { files: files.sort(), directories: directories.sort() };
}

/** Reject non-directory destinations without losing their caller-visible path. */
export function assertRealExportDirectory(
  output: string,
  stat: Pick<fs.Stats, "isDirectory" | "isSymbolicLink">,
): void {
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw exportError(`Export ownership requires a real directory: ${output}.`);
}

/** Validate ownership and return the exact existing names authorized for cleanup. */
export async function assertExportOwnership(
  output: string,
): Promise<ExportEntries | undefined> {
  const stat = await fs.promises
    .lstat(output)
    .catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined;
      throw error;
    });
  if (!stat) return;
  assertRealExportDirectory(output, stat);
  const { files, directories } = await ownedEntries(output);
  if (files.length === 0 && directories.length === 0)
    return { files, directories };
  if (!files.includes(EXPORT_MARKER))
    throw exportError(
      `Export ownership is missing: ${output}; choose an empty directory.`,
    );
  const parsed = parseExportOwnership(
    await fs.promises.readFile(path.join(output, EXPORT_MARKER), "utf8"),
  );
  if (parsed.kind !== "valid")
    throw exportError(`Invalid export ownership inventory: ${output}.`);
  const paths = parsed.value.files.map(({ path: name }) => name);
  const allowed = new Set([...paths, EXPORT_MARKER]);
  const unexpected = [
    ...files.filter((name) => !allowed.has(name)),
    ...directories.filter(
      (name) => !paths.some((file) => file.startsWith(`${name}/`)),
    ),
  ].sort();
  if (unexpected.length)
    throw exportError(
      `Export output contains unowned files or directories: ${output}:\n${unexpected.map((name) => `- ${name}`).join("\n")}\nMove these files or directories before exporting.`,
    );
  return { files, directories };
}
