/** Go-side file-load filter that excludes ordinary root-installed package files. */

import fs from "node:fs";
import path from "node:path";

/** Include every path that the repository ownership check can admit. */
export function repositoryLoadFilter(
  repoRoot: string,
  capturedPaths: Iterable<string>,
): RegExp {
  if (process.platform === "win32") return /.*/;
  const roots = new Set([repoRoot, fs.realpathSync(repoRoot)]);
  const separator = escapeRegex(path.sep);
  const repository = `(?:${[...roots]
    .map(
      (root) =>
        `${escapeRegex(root.endsWith(path.sep) ? root.slice(0, -1) : root)}${separator}`,
    )
    .join("|")})`;
  const outsidePackages = `${repository}${nonPackageSegment()}(?:${separator}|$)`;
  const prefixes = new Set<string>();
  for (const sourcePath of capturedPaths)
    for (const root of roots) prefixes.add(path.resolve(root, sourcePath));
  for (const relative of installedLinks(repoRoot))
    for (const root of roots) prefixes.add(path.resolve(root, relative));
  const aliases = [...prefixes].map(escapeRegex).join("|");
  return new RegExp(
    `^(?:${outsidePackages}${aliases ? `|(?:${aliases})(?:${separator}|$)` : ""})`,
  );
}

function installedLinks(repoRoot: string): string[] {
  const installedRoot = path.join(repoRoot, "node_modules");
  try {
    const entry = fs.lstatSync(installedRoot);
    if (entry.isSymbolicLink()) return ["node_modules"];
    if (!entry.isDirectory()) return [];
  } catch {
    return ["node_modules"];
  }
  const prefixes: string[] = [];
  const pending = [installedRoot];
  while (pending.length > 0) {
    const directory = pending.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      prefixes.push(path.relative(repoRoot, directory));
      continue;
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink())
        prefixes.push(
          path.relative(repoRoot, path.join(directory, entry.name)),
        );
      else if (entry.isDirectory())
        pending.push(path.join(directory, entry.name));
    }
  }
  return prefixes;
}

function nonPackageSegment(): string {
  const segment = "node_modules";
  const alternatives: string[] = [];
  for (let index = 0; index < segment.length; index++) {
    const prefix = segment.slice(0, index);
    if (prefix) alternatives.push(prefix);
    alternatives.push(
      `${prefix}[^${segment[index]}${path.sep}][^${path.sep}]*`,
    );
  }
  alternatives.push(`${segment}[^${path.sep}]+`);
  return `(?:${alternatives.join("|")})`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
