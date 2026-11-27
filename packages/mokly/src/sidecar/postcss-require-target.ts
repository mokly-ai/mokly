import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { resolveRequire } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { importerDirectory } from "./package-directory.js";
import { inside } from "./path-scope.js";

/** Select a native require target and keep the name used to reach it. */
export function postcssRequireTarget(
  sources: ModulePaths,
  name: string,
  file: string,
  options?: { paths?: string[] },
  reportTarget = false,
) {
  const authored = name;
  const alias = Object.keys(sources.settings.aliases)
    .sort((a, b) => b.length - a.length)
    .find((key) => name === key || name.startsWith(key + "/"));
  if (alias) name = sources.settings.aliases[alias] + name.slice(alias.length);
  const directory = importerDirectory(sources, name, path.dirname(file));
  const native = createRequire(path.join(directory, path.basename(file)));
  const resolvers = [
    native,
    ...sources.dependencyRoots.map((root) =>
      createRequire(path.join(path.dirname(root), "package.json")),
    ),
  ];
  const selected = resolveRequire(sources, name, directory, resolvers, {
    options,
    reportTarget,
  });
  sources.dependencyUsage.resolvedSync(
    authored,
    path.dirname(file),
    selected.file,
  );
  const written =
    selected.declaredTarget ??
    (path.isAbsolute(name) || name.startsWith(".")
      ? path.resolve(directory, name)
      : selected.file);
  const named =
    reportTarget && sources.repositoryOwned(written)
      ? writtenRequirePath(written, selected.file, native)
      : selected.file;
  return { file: selected.file, named };
}

function writtenRequirePath(
  written: string,
  file: string,
  native: NodeJS.Require,
): string {
  if (written === file) return file;
  for (const candidate of [
    written,
    ...Object.keys(native.extensions).map((ext) => written + ext),
  ]) {
    try {
      const target = realpathSync.native(candidate);
      if (target === file) return candidate;
      if (candidate === written && inside(target, file))
        return path.join(written, path.relative(target, file));
    } catch {
      /* The native resolver has already selected the file. */
    }
  }
  return file;
}
