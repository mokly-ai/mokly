import fs from "node:fs";
import path from "node:path";

import { isPathSegment } from "@mokly/viewer/data";

import { MoklyError, errorMessage } from "../errors.js";
import {
  validateFolderRecord,
  type FolderRecord,
} from "../registry/folder_records.js";
import { invalidSegment } from "../registry/path_derivation.js";

import {
  discoveryPathError,
  isVanishedModule,
} from "./entry_discovery_paths.js";
import { toPosixPath } from "./paths.js";
import type { ResolvedRoot } from "./types.js";

/** Read a directory record in its root's path space. */
export function readFolderFile(
  filename: string,
  root: ResolvedRoot,
  repoRoot: string,
): FolderRecord | undefined {
  const location = toPosixPath(path.relative(repoRoot, filename));
  const directories = toPosixPath(
    path.relative(root.dir, path.dirname(filename)),
  )
    .split("/")
    .filter((part) => part && !root.transparent.includes(part));
  for (const directory of directories)
    if (!isPathSegment(directory)) {
      const diagnostic = invalidSegment(location, "directory name", directory);
      throw new MoklyError(
        "build-invalid",
        `[${diagnostic.code}] ${diagnostic.message}`,
      );
    }
  const folderPath = [
    ...(root.path ? root.path.split("/") : []),
    ...directories,
  ].join("/");
  let content: string;
  try {
    content = fs.readFileSync(filename, "utf8");
  } catch (cause) {
    if (isVanishedModule(cause)) return undefined;
    throw discoveryPathError(filename, repoRoot, cause);
  }
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch (cause) {
    throw new MoklyError(
      "build-invalid",
      `[invalid-folder] ${location}: invalid JSON: ${errorMessage(cause)}`,
      { cause },
    );
  }
  return validateFolderRecord(value, folderPath, location, location, true);
}
