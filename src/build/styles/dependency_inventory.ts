import fs from "node:fs";
import path from "node:path";

import { isInside, projectRealPath, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";
import { MANIFEST_NAME } from "../../registry/manifest.js";
import { isOwned } from "../ownership.js";

import {
  walkDependencyDirectory,
  ignoredDependencyPath,
} from "./dependency_walk.js";
import type { StyleDependencyReport } from "./postcss.js";
import { GENERATED_DIRECTORY } from "./routes.js";

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
  const ordered = [...reports].sort((first, second) =>
    `${first.source}\0${first.plugin}\0${first.type}`.localeCompare(
      `${second.source}\0${second.plugin}\0${second.type}`,
    ),
  );
  for (const report of ordered) {
    if (report.malformed)
      throw new MoklyError(
        "build-invalid",
        `PostCSS plugin ${report.plugin} reported an invalid dependency for ${relative(config, report.source)}; report a file or directory path and optional glob`,
      );
    const file = path.resolve(
      path.dirname(report.source),
      report.type === "dependency" ? report.file! : report.directory!,
    );
    if (ignoredDependencyPath(file, config)) continue;
    if (report.type === "dependency") {
      explicit.push({ file, report });
    } else {
      if (!fs.statSync(file, { throwIfNoEntry: false })?.isDirectory())
        throw new MoklyError(
          "build-invalid",
          `PostCSS plugin ${report.plugin} reported a missing directory dependency for ${relative(config, report.source)}: ${relative(config, file)}; create the directory or correct the plugin`,
        );
      const glob = report.glob ?? "**/*";
      directories.set(`${file}\0${glob}`, { directory: file, glob });
      for (const matched of walkDependencyDirectory(file, glob, config))
        expanded.push({ file: matched, report, directory: file });
    }
  }
  const sorted = (candidates: readonly Candidate[]) =>
    [...candidates].sort((first, second) =>
      relative(config, first.file).localeCompare(relative(config, second.file)),
    );
  for (const candidate of sorted(explicit))
    if (isGenerated(candidate.file, config))
      throw generatedError(candidate, config);
  if (config.generatedOutput === "committed")
    for (const candidate of sorted(expanded))
      if (isGenerated(candidate.file, config))
        throw generatedError(candidate, config);
  const sourceFiles = new Set<string>();
  for (const candidate of [...sorted(explicit), ...sorted(expanded)]) {
    if (isGenerated(candidate.file, config)) continue;
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
      `${first.directory}\0${first.glob}`.localeCompare(
        `${second.directory}\0${second.glob}`,
      ),
    ),
  };
}

function isGenerated(file: string, config: ResolvedConfig): boolean {
  const physicalMockups = projectRealPath(config.mockupsDir);
  const physicalFile = projectRealPath(file);
  return [
    { candidate: file, root: config.mockupsDir, context: config },
    {
      candidate: physicalFile,
      root: physicalMockups,
      context: { ...config, mockupsDir: physicalMockups },
    },
  ].some(({ candidate, root, context }) => {
    if (!isInside(root, candidate)) return false;
    const relativePath = path.relative(root, candidate);
    return (
      relativePath === MANIFEST_NAME ||
      relativePath === GENERATED_DIRECTORY ||
      relativePath.startsWith(`${GENERATED_DIRECTORY}${path.sep}`) ||
      isOwned(candidate, context)
    );
  });
}

function isPublicMockupsDependency(
  file: string,
  config: ResolvedConfig,
  graphInputs: ReadonlySet<string>,
): boolean {
  const physical = projectRealPath(file);
  return (
    (isInside(config.mockupsDir, file) ||
      isInside(projectRealPath(config.mockupsDir), physical)) &&
    !graphInputs.has(file) &&
    !graphInputs.has(physical)
  );
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
