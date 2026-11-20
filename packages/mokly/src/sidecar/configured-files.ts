import path from "node:path";

import type { Plugin } from "esbuild";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import type { ModulePaths } from "./module-paths.js";
import { plannedResult } from "./native-plan.js";
import { planKey } from "./native-resolution.js";
import type { Resolution } from "./native-resolution.js";
import { PackageScope } from "./package-scope.js";
import { absoluteSpecifierPattern } from "./path-pattern.js";

/** Generated imports select their configured files without TypeScript path remapping. */
export function configuredFiles(
  params: BundleParams,
  paths: ModulePaths,
  preview: string | null | undefined,
  resolution: Resolution,
): Plugin {
  const importer = path.resolve(params.sourceRoot, "mokly-entry");
  const configured = new Set(
    [
      ...params.entryFiles,
      ...params.storiesFiles,
      ...(params.renderer ? [params.renderer] : []),
      ...(preview ? [preview] : []),
    ].map((file) => path.resolve(params.sourceRoot, file)),
  );
  const scope = new PackageScope();
  return {
    name: "mokly-configured-files",
    setup(build) {
      build.onResolve({ filter: absoluteSpecifierPattern }, async (args) => {
        if (
          args.namespace !== "file" ||
          args.pluginData !== undefined ||
          args.importer !== importer ||
          !configured.has(args.path)
        )
          return;
        const file = await paths.resolve(args.path);
        const planned =
          resolution.mode === "planned"
            ? resolution.plan.get(planKey(args.importer, args.path, args.kind))
            : undefined;
        if (planned?.path === file) return plannedResult(paths, args, planned);
        return { path: file, sideEffects: await scope.sideEffects(file) };
      });
    },
  };
}
