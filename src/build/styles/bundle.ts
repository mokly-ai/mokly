import path from "node:path";

import { isInside } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { timeAsync } from "../../diagnostics/timings.js";
import { MoklyError } from "../../errors.js";
import type { GeneratedFile } from "../generated_file.js";

import { bundleStylePass, type StyleRoot } from "./bundle_pass.js";
import { acceptStyleOutput } from "./outputs.js";
import type { StylePreprocessor } from "./preprocess.js";
import { stylesheetRoute } from "./routes.js";

/** CSS outputs and private dependencies from all delivery roots. */
export interface BundledStyles {
  readonly outputs: ReadonlyMap<string, GeneratedFile>;
  readonly routes: ReadonlyMap<string, string>;
  readonly sourceFiles: ReadonlySet<string>;
}

/** Bundle renderer first, then all entries in one shared stylesheet pass. */
export async function bundleStyles(
  config: ResolvedConfig,
  roots: readonly {
    readonly path: string;
    readonly styles: readonly string[];
  }[],
  graphInputs: ReadonlySet<string>,
  preprocessor: StylePreprocessor,
): Promise<BundledStyles> {
  const outputs = new Map<string, GeneratedFile>();
  const routes = new Map<string, string>();
  const sourceFiles = new Set<string>();
  const rendererFiles = new Set<string>();

  const accept = (
    pass: Awaited<ReturnType<typeof bundleStylePass>>,
    passRoots: readonly StyleRoot[],
  ) => {
    for (const root of passRoots) {
      const closure = pass.closures.get(root.path);
      for (const file of [
        ...(closure ?? []),
        ...(pass.inputs.get(root.path) ?? []),
      ]) {
        if (
          isInside(config.repoRoot, file) &&
          !path
            .relative(config.repoRoot, file)
            .split(path.sep)
            .includes("node_modules")
        )
          sourceFiles.add(file);
      }
      if (pass.outputs.has(root.route)) routes.set(root.path, root.route);
    }
    for (const file of pass.assets) {
      if (
        isInside(config.repoRoot, file) &&
        !path
          .relative(config.repoRoot, file)
          .split(path.sep)
          .includes("node_modules")
      )
        sourceFiles.add(file);
    }
    for (const [route, contents] of pass.outputs)
      acceptStyleOutput(outputs, route, contents);
  };

  const seenRoots = new Set<string>();
  const rootFor = (
    root: (typeof roots)[number],
    excluded: ReadonlySet<string>,
  ) => {
    const route = stylesheetRoute(root.path, config.repoRoot);
    if (seenRoots.has(root.path))
      throw new MoklyError(
        "build-invalid",
        `generated route collision: ${route}; give each entry root a distinct repository path`,
      );
    seenRoots.add(root.path);
    return {
      path: root.path,
      route,
      direct: root.styles.filter((file) => !excluded.has(file)),
    };
  };

  const renderer = roots.find((root) => root.path === config.renderer);
  if (renderer?.styles.length) {
    const root = rootFor(renderer, new Set());
    const pass = await timeAsync("styles.bundle", () =>
      bundleStylePass(config, [root], new Set(), graphInputs, preprocessor),
    );
    for (const file of pass.closures.get(root.path) ?? [])
      rendererFiles.add(file);
    accept(pass, [root]);
  }

  const entries = roots
    .filter((root) => root !== renderer && root.styles.length)
    .map((root) => rootFor(root, rendererFiles))
    .filter((root) => root.direct.length);
  if (entries.length) {
    const pass = await timeAsync("styles.bundle", () =>
      bundleStylePass(
        config,
        entries,
        rendererFiles,
        graphInputs,
        preprocessor,
      ),
    );
    accept(pass, entries);
  }

  return { outputs, routes, sourceFiles };
}
