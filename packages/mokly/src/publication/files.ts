import fs from "node:fs";
import path from "node:path";

import { isBaselineCachePath } from "../config/cache_paths.js";
import { locatePath, type FileLocation } from "../config/file_locations.js";
import { isInside, projectRealPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";

/** A confined file, or link metadata whose target must not be read. */
export type PublicationFile =
  | { kind: "file"; path: string; location: FileLocation; link?: string }
  | { kind: "link"; path: string; link: string };

/** Enumerate logical routes while checking every target before reading or traversal. */
export async function publicationFiles(
  config: ResolvedConfig,
  root: string,
  excludedRoots: readonly string[],
  publicRoot = false,
): Promise<PublicationFile[]> {
  const excluded = excludedRoots.flatMap((file) => [
    file,
    projectRealPath(file),
  ]);
  const realRepoRoot = fs.realpathSync(config.repoRoot);
  const files: PublicationFile[] = [];
  function excludedPath(file: string): boolean {
    const parts = path.relative(config.repoRoot, file).split(path.sep);
    return (
      isBaselineCachePath(file, config.repoRoot) ||
      excluded.some((directory) => isInside(directory, file)) ||
      parts.includes(".git") ||
      (!publicRoot &&
        parts.some((part) =>
          [".context", "node_modules", "target"].includes(part),
        )) ||
      isComparisonPath(file, config)
    );
  }
  async function visit(
    directory: string,
    ancestors: ReadonlySet<string>,
  ): Promise<void> {
    const location = locatePath(directory, config.repoRoot);
    if (!location) throw inputError(directory);
    if (ancestors.has(location.physicalPath)) return;
    const nextAncestors = new Set([...ancestors, location.physicalPath]);
    const entries = await fs.promises.readdir(location.physicalPath, {
      withFileTypes: true,
    });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (excludedPath(file)) continue;
      const target = locatePath(file, config.repoRoot);
      if (
        target &&
        (excludedPath(target.physicalPath) ||
          hasArtifactMarker(target.physicalPath, realRepoRoot))
      )
        continue;
      if (entry.isSymbolicLink()) {
        const link = await fs.promises.readlink(file);
        const stat = target
          ? await fs.promises.stat(target.physicalPath)
          : undefined;
        if (target && stat?.isFile())
          files.push({ kind: "file", path: file, location: target, link });
        else {
          files.push({ kind: "link", path: file, link });
          if (stat?.isDirectory()) await visit(file, nextAncestors);
        }
      } else if (entry.isDirectory()) await visit(file, nextAncestors);
      else if (entry.isFile()) {
        if (!target) throw inputError(file);
        files.push({ kind: "file", path: file, location: target });
      }
    }
  }
  await visit(root, new Set());
  return files;
}

/** Require explicit metadata and authoring inputs to be confined regular files. */
export async function publicationInput(
  file: string,
  repoRoot: string,
): Promise<PublicationFile & { kind: "file" }> {
  const location = locatePath(file, repoRoot);
  if (!location || !(await fs.promises.stat(location.physicalPath)).isFile())
    throw inputError(file);
  const stat = await fs.promises.lstat(file);
  return {
    kind: "file",
    path: file,
    location,
    ...(stat.isSymbolicLink()
      ? { link: await fs.promises.readlink(file) }
      : {}),
  };
}

/** Revalidate the captured identity and read only its confined physical location. */
export async function readPublicationFile(
  file: PublicationFile & { kind: "file" },
  repoRoot: string,
): Promise<Buffer> {
  const current = await publicationInput(file.path, repoRoot);
  if (
    current.location.physicalPath !== file.location.physicalPath ||
    current.link !== file.link
  )
    throw new Error(`publication input changed location: ${file.path}`);
  return fs.promises.readFile(current.location.physicalPath);
}

/** Exclude previously generated artifacts from both logical and physical walks. */
function isComparisonPath(file: string, config: ResolvedConfig): boolean {
  if (
    isInside(config.review.outDir, file) ||
    isInside(projectRealPath(config.review.outDir), file)
  )
    return true;
  const parts = path.relative(config.mockupsDir, file).split(path.sep);
  return (
    parts.includes(".comparisons") ||
    (parts.includes("__mokly") && parts.includes("diffs"))
  );
}

/** Inspect artifact ownership only after the path is physically confined. */
function hasArtifactMarker(file: string, repoRoot: string): boolean {
  let directory = file;
  while (isInside(repoRoot, directory)) {
    if (
      fs.existsSync(path.join(directory, ".mokly-review-artifact")) ||
      fs.existsSync(path.join(directory, ".mokly-preview-artifact"))
    )
      return true;
    if (directory === repoRoot) break;
    directory = path.dirname(directory);
  }
  return false;
}

function inputError(file: string): Error {
  return new Error(
    `publication input must be a confined regular file inside repoRoot: ${file}`,
  );
}
