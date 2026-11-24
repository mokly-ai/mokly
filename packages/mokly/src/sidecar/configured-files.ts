import path from "node:path";

import type { Plugin } from "esbuild";

import { virtualEntry } from "./bundle-entry.js";
import type { ModulePaths } from "./module-paths.js";
import { plannedResult } from "./native-plan.js";
import type { Resolution } from "./native-resolution.js";
import { PackageScope } from "./package-scope.js";
import { absoluteSpecifierPattern } from "./path-pattern.js";

/** Generated imports select their configured files without TypeScript path remapping. */
export function configuredFiles(
  paths: ModulePaths,
  resolution: Resolution,
): Plugin {
  const importer = path.resolve(paths.sourceRoot, virtualEntry);
  const scope = new PackageScope();
  return {
    name: "mokly-configured-files",
    setup(build) {
      build.onResolve({ filter: absoluteSpecifierPattern }, async (args) => {
        if (
          args.namespace !== "file" ||
          args.pluginData !== undefined ||
          args.importer !== importer ||
          !paths.configuredFile(args.path)
        )
          return;
        const file = await paths.resolve(args.path);
        const planned =
          resolution.mode === "planned"
            ? resolution.plan.get(args.importer, args.path, args.kind)
            : undefined;
        if (
          resolution.mode === "planned" &&
          planned &&
          resolution.plan.plan.paths[planned[3]] === file
        )
          return plannedResult(paths, args, resolution.plan.plan, planned);
        return { path: file, sideEffects: await scope.sideEffects(file) };
      });
    },
  };
}
