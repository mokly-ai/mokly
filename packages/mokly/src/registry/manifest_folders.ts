import type { ResolvedRegistryEntry } from "../authoring/types.js";
import { MoklyError } from "../errors.js";

import { validateFolderRecord, type FolderRecord } from "./folder_records.js";
import { folderViolations } from "./folder_validation.js";
import { record, validateRepoPath } from "./manifest_values.js";

/** Validate persisted folder carriers with the same schema and path-tree rules. */
export function validateManifestFolders(
  value: unknown,
  entries: readonly unknown[],
  sourceFiles: readonly string[],
): void {
  const fail = (message: string): never => {
    throw new MoklyError("manifest-invalid", message);
  };
  if (!Array.isArray(value)) fail("folders must be an array");
  const folders: FolderRecord[] = [];
  for (const item of value as unknown[]) {
    if (
      !record(item) ||
      typeof item.path !== "string" ||
      typeof item.sourcePath !== "string"
    )
      fail("invalid folder record");
    const { path, sourcePath, ...fields } = item as Record<string, unknown> & {
      path: string;
      sourcePath: string;
    };
    validateRepoPath(sourcePath, "folder sourcePath");
    if (!sourceFiles.includes(sourcePath))
      fail(`sourceFiles omits ${sourcePath}`);
    const directory = sourcePath.split("/").at(-1) === "_folder.json";
    try {
      folders.push(
        validateFolderRecord(
          directory ? fields : { path, ...fields },
          path,
          sourcePath,
          sourcePath,
          directory,
        ),
      );
    } catch (error) {
      fail(error instanceof Error ? error.message : "invalid folder record");
    }
  }
  const validEntries = entries.filter(
    (entry): entry is ResolvedRegistryEntry =>
      record(entry) && typeof entry.path === "string",
  );
  const violation = folderViolations(folders, validEntries)[0];
  if (violation) fail(violation.message);
  if (
    JSON.stringify(folders.map((folder) => folder.path)) !==
    JSON.stringify(folders.map((folder) => folder.path).sort())
  )
    fail("folders must sort by path");
}
