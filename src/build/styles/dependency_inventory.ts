import fs from "node:fs";
import path from "node:path";

import { logicalRepositoryPath } from "../../config/file_locations.js";
import { compareCodeUnits } from "../../config/path_order.js";
import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

import {
  dependencyOwnership,
  ignoredDependencyPath,
  walkDependencyDirectory,
  type DependencyPathCache,
} from "./dependency_walk.js";
import type { StyleDependencyReport } from "./postcss.js";
import { wouldPrivatizePublicFile } from "./public_source.js";

/** Package-owned directory root, including its reported glob for new files. */
export interface PostcssWatchDirectory {
  readonly directory: string;
  readonly glob: string;
}

/** Validated PostCSS inventory and directories watched for matching additions. */
export interface PostcssDependencies {
  readonly sourceFiles: ReadonlySet<string>;
  readonly watchDirectories: readonly PostcssWatchDirectory[];
}

interface Candidate {
  readonly file: string;
  readonly report: StyleDependencyReport;
  readonly directory?: string;
}

/** Apply generated-output precedence before public-source and regular-file checks. */
export function collectPostcssDependencies(
  config: ResolvedConfig,
  reports: readonly StyleDependencyReport[],
  graphInputs: ReadonlySet<string>,
): PostcssDependencies {
  const explicit: Candidate[] = [];
  const expanded: Candidate[] = [];
  const directories = new Map<string, PostcssWatchDirectory>();
  const scanned = new Map<string, readonly string[]>();
  const ownership: DependencyPathCache = new Map();
  const ordered = [...reports].sort((first, second) =>
    compareCodeUnits(
      `${first.source}\0${first.plugin}\0${first.type}`,
      `${second.source}\0${second.plugin}\0${second.type}`,
    ),
  );
  for (const report of ordered) {
    const source = logicalRepositoryPath(report.source, config.repoRoot);
    if (report.malformed)
      throw new MoklyError(
        "build-invalid",
        `PostCSS plugin ${report.plugin} reported an invalid dependency for ${relative(config, source)}; report a file or directory path and optional glob`,
      );
    const file = logicalRepositoryPath(
      path.resolve(
        path.dirname(source),
        report.type === "dependency" ? report.file! : report.directory!,
      ),
      config.repoRoot,
    );
    const normalizedReport = { ...report, source };
    if (ignoredDependencyPath(file, config, ownership)) continue;
    if (report.type === "dependency") {
      explicit.push({ file, report: normalizedReport });
    } else {
      if (!fs.statSync(file, { throwIfNoEntry: false })?.isDirectory())
        throw new MoklyError(
          "build-invalid",
          `PostCSS plugin ${report.plugin} reported a missing directory dependency for ${relative(config, source)}: ${relative(config, file)}; create the directory or correct the plugin`,
        );
      const glob = report.glob ?? "**/*";
      const key = `${file}\0${glob}`;
      if (dependencyOwnership(file, config, ownership) !== "generated")
        directories.set(key, { directory: file, glob });
      let matches = scanned.get(key);
      if (!matches) {
        matches = walkDependencyDirectory(file, glob, config, ownership);
        scanned.set(key, matches);
      }
      for (const matched of matches)
        expanded.push({
          file: matched,
          report: normalizedReport,
          directory: file,
        });
    }
  }
  const sorted = (candidates: readonly Candidate[]) =>
    [...candidates].sort((first, second) =>
      compareCodeUnits(
        relative(config, first.file),
        relative(config, second.file),
      ),
    );
  for (const candidate of sorted(explicit))
    if (isGenerated(candidate.file, config, ownership))
      throw generatedError(candidate, config);
  if (config.generatedOutput === "committed")
    for (const candidate of sorted(expanded))
      if (isGenerated(candidate.file, config, ownership))
        throw generatedError(candidate, config);
  const sourceFiles = new Set<string>();
  const explicitPaths = new Set(explicit.map(({ file }) => file));
  for (const candidate of [
    ...sorted(explicit),
    ...sorted(expanded).filter(({ file }) => !explicitPaths.has(file)),
  ]) {
    if (isGenerated(candidate.file, config, ownership)) continue;
    if (isPublicMockupsDependency(candidate.file, config, graphInputs))
      throw publicError(candidate, config);
    if (!fs.statSync(candidate.file, { throwIfNoEntry: false })?.isFile())
      throw new MoklyError(
        "build-invalid",
        `PostCSS plugin ${candidate.report.plugin} reported a missing dependency for ${relative(config, candidate.report.source)}: ${relative(config, candidate.file)}; make it a regular file or correct the plugin`,
      );
    sourceFiles.add(candidate.file);
  }
  return {
    sourceFiles,
    watchDirectories: [...directories.values()].sort((first, second) =>
      compareCodeUnits(
        `${first.directory}\0${first.glob}`,
        `${second.directory}\0${second.glob}`,
      ),
    ),
  };
}

function isGenerated(
  file: string,
  config: ResolvedConfig,
  cache: DependencyPathCache,
): boolean {
  return dependencyOwnership(file, config, cache) === "generated";
}

function isPublicMockupsDependency(
  file: string,
  config: ResolvedConfig,
  graphInputs: ReadonlySet<string>,
): boolean {
  return wouldPrivatizePublicFile(file, config, graphInputs);
}

function generatedError(
  candidate: Candidate,
  config: ResolvedConfig,
): MoklyError {
  const { plugin, source } = candidate.report;
  const file = relative(config, candidate.file);
  const stylesheet = relative(config, source);
  const scanRoot = candidate.directory
    ? `exclude mockupsDir by excluding the matching scan root (Tailwind: @source not "${relativeFrom(source, candidate.directory)}" or source(none) with explicit @source)`
    : `exclude mockupsDir from the plugin's sources (Tailwind: @source not "${relativeFrom(source, config.mockupsDir)}")`;
  return new MoklyError(
    "build-invalid",
    candidate.directory
      ? `PostCSS plugin ${plugin} directory dependency scans Mokly-generated output in ${stylesheet}: ${file}; ${scanRoot}`
      : `PostCSS plugin ${plugin} scanned Mokly-generated output in ${stylesheet}: ${file}; ${scanRoot}`,
  );
}

function publicError(candidate: Candidate, config: ResolvedConfig): MoklyError {
  const { plugin, source } = candidate.report;
  const file = relative(config, candidate.file);
  const stylesheet = relative(config, source);
  return new MoklyError(
    "build-invalid",
    candidate.directory
      ? `PostCSS plugin ${plugin} directory dependency scans a public mockups file in ${stylesheet}: ${file}; exclude mockupsDir by excluding the matching scan root (Tailwind: @source not "${relativeFrom(source, candidate.directory)}" or source(none) with explicit @source)`
      : `PostCSS plugin ${plugin} scanned a public mockups file in ${stylesheet}: ${file}; exclude mockupsDir from the plugin's sources (Tailwind: @source not "${relativeFrom(source, config.mockupsDir)}")`,
  );
}

function relative(config: ResolvedConfig, file: string): string {
  return toPosixPath(path.relative(config.repoRoot, file));
}

function relativeFrom(source: string, directory: string): string {
  const result = toPosixPath(path.relative(path.dirname(source), directory));
  return result === "" ? "." : result.startsWith(".") ? result : `./${result}`;
}
