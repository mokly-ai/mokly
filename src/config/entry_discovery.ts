import path from "node:path";

import { MoklyError } from "../errors.js";
import type { FolderRecord } from "../registry/folder_records.js";

import { discoveryPaths } from "./entry_discovery_paths.js";
import {
  entryModuleDenial,
  entryModuleError,
} from "./entry_discovery_validation.js";
import { walkEntryCandidates } from "./entry_discovery_walk.js";
import { toPosixPath } from "./paths.js";
import type { ResolvedConfig } from "./types.js";

/** A fresh root-owned entry set and the complete protected source inputs. */
export interface EntryDiscovery {
  entryModules: readonly string[];
  resolvedFiles: readonly string[];
  protectedFiles: readonly string[];
  folderRecords: readonly FolderRecord[];
  rootByFile: Readonly<Record<string, number>>;
}

/** Discover a fresh candidate without changing any accepted configuration. */
export function discoverEntries(
  config: Pick<ResolvedConfig, "roots" | "repoRoot" | "review">,
): EntryDiscovery {
  const paths = discoveryPaths(config);
  const discovered = new Set<string>();
  const protectedFiles = new Set<string>();
  const folderRecords: FolderRecord[] = [];
  const vanished = new Set<string>();
  const owners = new Map<string, { index: number; relative: string }>();
  const rootByFile = new Map<string, number>();
  const claim = (candidate: string, index: number): void => {
    const source = toPosixPath(path.relative(config.repoRoot, candidate));
    const physical = paths.realFiles.get(candidate)!;
    const previous = owners.get(physical);
    if (previous && previous.index !== index)
      throw new MoklyError(
        "config-invalid",
        `file ${previous.relative} is matched by roots[${previous.index}] and roots[${index}]`,
      );
    owners.set(physical, { index, relative: source });
    rootByFile.set(source, index);
  };
  for (const [rootIndex, selected] of paths.roots.entries()) {
    const { root, matchers } = selected;
    const deniedRoots: string[] = [];
    const skippedRoots: string[] = [];
    let matched = 0;
    for (const { file: candidate, excluded } of walkEntryCandidates({
      root,
      deniedRoots,
      skippedRoots,
      paths,
      configured: selected.config,
      records: folderRecords,
      claimFolder: (file) => claim(file, rootIndex),
    })) {
      const relative = toPosixPath(path.relative(root, candidate));
      if (!matchers.some((matcher) => matcher.match(relative))) continue;
      if (vanished.has(candidate)) {
        skippedRoots.push(candidate);
        continue;
      }
      if (!protectedFiles.has(candidate)) {
        const reason = entryModuleDenial(candidate, paths);
        if (reason === null) {
          vanished.add(candidate);
          skippedRoots.push(candidate);
          continue;
        }
        if (reason) throw entryModuleError(candidate, reason, config);
      }
      protectedFiles.add(candidate);
      claim(candidate, rootIndex);
      if (excluded) continue;
      matched += 1;
      discovered.add(candidate);
    }
    if (matched === 0) {
      const notSearched = [...new Set([...deniedRoots, ...skippedRoots])]
        .map((deniedRoot) =>
          toPosixPath(path.relative(config.repoRoot, deniedRoot)),
        )
        .sort((left, right) => left.localeCompare(right));
      throw new MoklyError(
        "config-invalid",
        `root matches no file: ${toPosixPath(path.relative(config.repoRoot, root)) || "."}${notSearched.length > 0 ? `; not searched: ${notSearched.join(", ")}` : ""}`,
      );
    }
  }
  const order = (left: string, right: string) =>
    toPosixPath(path.relative(config.repoRoot, left)).localeCompare(
      toPosixPath(path.relative(config.repoRoot, right)),
    );
  const files = [...discovered].sort(order);
  return {
    folderRecords,
    rootByFile: Object.fromEntries(rootByFile),
    resolvedFiles: files,
    protectedFiles: [...protectedFiles].sort(order),
    entryModules: files.filter((file) => !/\.md$/i.test(file)),
  };
}

/** Resolve executable modules when a caller needs only discovery membership. */
export function discoverEntryModules(
  config: Pick<ResolvedConfig, "roots" | "repoRoot" | "review">,
): readonly string[] {
  return discoverEntries(config).entryModules;
}
