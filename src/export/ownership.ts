import fs from "node:fs";
import path from "node:path";

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { exportError } from "./error.js";

/** Public-safe proof that a directory was installed by the exporter. */
export const EXPORT_MARKER = ".mokly-export-artifact";

/** Versioned list of files the exporter is allowed to replace. */
export interface ExportOwnership {
  schemaVersion: 1;
  files: readonly string[];
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
): ExportOwnership | undefined {
  try {
    const value: unknown = JSON.parse(content);
    if (
      !value ||
      typeof value !== "object" ||
      !("schemaVersion" in value) ||
      value.schemaVersion !== 1 ||
      !("files" in value) ||
      !Array.isArray(value.files)
    )
      return undefined;
    const files: unknown[] = value.files;
    if (
      !files.every(
        (name): name is string =>
          typeof name === "string" &&
          isSafeRepositoryPath(name) &&
          name !== EXPORT_MARKER,
      )
    )
      return undefined;
    if (new Set(files.map((name) => name.toLowerCase())).size !== files.length)
      return undefined;
    return { schemaVersion: 1, files };
  } catch {
    return undefined;
  }
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
  const marker = parseExportOwnership(
    await fs.promises.readFile(path.join(output, EXPORT_MARKER), "utf8"),
  );
  if (!marker) throw exportError("Invalid export ownership inventory.");
  const allowed = new Set([...marker.files, EXPORT_MARKER]);
  if (
    files.some((name) => !allowed.has(name)) ||
    directories.some(
      (name) => !marker.files.some((file) => file.startsWith(`${name}/`)),
    )
  )
    throw exportError(
      "Export output contains unowned files or directories; move them before exporting.",
    );
  return { files, directories };
}
