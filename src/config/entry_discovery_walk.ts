import path from "node:path";

import { minimatch } from "minimatch";

import type { FolderRecord } from "../registry/folder_records.js";

import type { DiscoveryPaths } from "./entry_discovery_paths.js";
import {
  entryModuleDenial,
  entryModuleError,
  isSkippedEntryDirectory,
  readEntryDirectory,
} from "./entry_discovery_validation.js";
import { readFolderFile } from "./folder_files.js";
import { toPosixPath } from "./paths.js";
import { isDeniedSourceSegment } from "./private_directories.js";
import type { ResolvedRoot } from "./types.js";

interface Exclusion {
  dir: string;
  globs: readonly string[];
}
interface WalkInput {
  root: string;
  deniedRoots: string[];
  skippedRoots: string[];
  paths: DiscoveryPaths;
  configured: ResolvedRoot;
  records: FolderRecord[];
  claimFolder: (file: string) => void;
}
interface Candidate {
  file: string;
  excluded: boolean;
}

/** Traverse directories independently of file exclusions, retaining private inputs. */
export function walkEntryCandidates(
  input: WalkInput,
  inherited: readonly Exclusion[] = [],
): Candidate[] {
  const {
    root,
    deniedRoots,
    skippedRoots,
    paths,
    configured,
    records,
    claimFolder,
  } = input;
  const entries = readEntryDirectory(root, skippedRoots, paths.repoRoot);
  const folderFile = entries.find(
    (entry) => entry.isFile() && entry.name === "_folder.json",
  );
  let exclusions = inherited;
  if (folderFile) {
    const filename = path.join(root, folderFile.name);
    const denial = entryModuleDenial(filename, paths);
    if (denial) throw entryModuleError(filename, denial, paths);
    if (denial === null) skippedRoots.push(filename);
    else {
      claimFolder(filename);
      if (!isExcluded(filename, inherited)) {
        const record = readFolderFile(filename, configured, paths.repoRoot);
        if (record) {
          records.push(record);
          exclusions = [
            ...inherited,
            { dir: root, globs: record.exclude ?? [] },
          ];
        } else skippedRoots.push(filename);
      }
    }
  }
  return entries
    .flatMap((entry): Candidate[] => {
      const candidate = path.join(root, entry.name);
      if (entry.name === "_folder.json") return [];
      if (entry.isDirectory()) {
        if (isDeniedSourceSegment(entry.name)) {
          deniedRoots.push(candidate);
          return [];
        }
        if (isSkippedEntryDirectory(candidate, paths, skippedRoots)) return [];
        return walkEntryCandidates({ ...input, root: candidate }, exclusions);
      }
      return entry.isFile()
        ? [{ file: candidate, excluded: isExcluded(candidate, exclusions) }]
        : [];
    })
    .sort((left, right) => left.file.localeCompare(right.file));
}

function isExcluded(file: string, exclusions: readonly Exclusion[]): boolean {
  return exclusions.some(({ dir, globs }) =>
    globs.some((glob) =>
      minimatch(toPosixPath(path.relative(dir, file)), glob, { dot: true }),
    ),
  );
}
