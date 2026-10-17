import fs from "node:fs";
import path from "node:path";

import type { ModuleSources } from "./module-paths.js";
import { inside, logical } from "./path-scope.js";
import { resolutionOptions } from "./resolution.js";

export const INSTALLED_INPUT_PREFIX = "node_modules/.mokly-roots/installed/";

export interface SourceDependencyRoot {
  source: string;
  selected: string;
  logical: string;
}

interface SourceSide {
  sourceRoot: string;
  dependencyRoot: string | undefined;
  sourceDependencyRoots: SourceDependencyRoot[];
}

/** Source copies keep the same selected-root graph names as their working counterparts. */
export function sourceDependencyRoots(
  params: ModuleSources,
  sourceRoot: string,
  dependencyRoot: string | undefined,
  selected: string[],
): SourceDependencyRoot[] {
  if (!dependencyRoot) return [];
  const repositories = [
    path.resolve(params.moduleResolution.dependencyRoot!),
    dependencyRoot,
  ];
  const indexes = new Map(
    [...new Set(selected)].map((root, index) => [root, index]),
  );
  return resolutionOptions(
    sourceRoot,
    params.moduleResolution,
  ).nodePaths.flatMap((root, offset) => {
    const repository = repositories.find((repository) =>
      inside(repository, root),
    );
    if (!repository) return [];
    const index = indexes.get(selected[offset]!)!;
    return [
      {
        source: path.resolve(sourceRoot, logical(repository, root)),
        selected: selected[offset]!,
        logical: `node_modules${index ? `/.mokly-roots/${index}` : ""}`,
      },
    ];
  });
}

export function sourceDependencyName(
  roots: SourceDependencyRoot[],
  file: string,
): string | undefined {
  const root = roots.find((root) => inside(root.source, file));
  return root && `${root.logical}/${logical(root.source, file)}`;
}

function candidates(paths: SourceSide, file: string): string[] {
  if (
    !paths.dependencyRoot ||
    paths.sourceRoot === paths.dependencyRoot ||
    inside(paths.sourceRoot, file)
  )
    return [];
  const roots = paths.sourceDependencyRoots.filter((root) =>
    inside(root.selected, file),
  );
  if (roots.length)
    return [
      ...new Set(
        roots.map((root) =>
          path.resolve(root.source, logical(root.selected, file)),
        ),
      ),
    ];
  if (inside(paths.dependencyRoot, file)) {
    const relative = logical(paths.dependencyRoot, file);
    if (relative.split("/").includes("node_modules"))
      return [path.resolve(paths.sourceRoot, relative)];
  }
  return [];
}

function absent(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    ["ENOENT", "ENOTDIR"].includes(String(error.code))
  );
}

function confined(paths: SourceSide, file: string): string {
  if (!inside(paths.sourceRoot, file))
    throw new Error("dependency source escapes this side's sourceRoot");
  return file;
}

/** A file present in the extracted Git sources wins over the selected installation. */
export async function sourceDependency(
  paths: SourceSide,
  file: string,
): Promise<string | undefined> {
  for (const candidate of candidates(paths, file)) {
    try {
      return confined(paths, await fs.promises.realpath(candidate));
    } catch (error) {
      if (!absent(error)) throw error;
    }
  }
  return undefined;
}

/** Runtime requires use the same extracted-source precedence as bundled imports. */
export function sourceDependencySync(
  paths: SourceSide,
  file: string,
): string | undefined {
  for (const candidate of candidates(paths, file)) {
    try {
      return confined(paths, fs.realpathSync(candidate));
    } catch (error) {
      if (!absent(error)) throw error;
    }
  }
  return undefined;
}
