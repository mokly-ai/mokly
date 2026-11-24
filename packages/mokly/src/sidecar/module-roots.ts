import fs from "node:fs";
import path from "node:path";

import type { ModuleSources } from "./module-paths.js";
import { resolutionOptions } from "./resolution.js";

export interface ModuleRoots {
  source: string;
  repositories: string[];
  dependencies: string[];
  installation: string | undefined;
}

export async function moduleRoots(params: ModuleSources): Promise<ModuleRoots> {
  const source = await fs.promises.realpath(params.sourceRoot);
  const repositories = await Promise.all(
    params.repositoryRoots.map((file) => fs.promises.realpath(file)),
  );
  const dependencies = await Promise.all(
    resolutionOptions(source, params.moduleResolution).nodePaths.map((file) =>
      fs.promises.realpath(file).catch(() => path.resolve(file)),
    ),
  );
  const installation =
    params.moduleResolution.dependencyRoot === undefined
      ? undefined
      : await fs.promises.realpath(params.moduleResolution.dependencyRoot);
  return { source, repositories, dependencies, installation };
}

export function moduleRootsSync(params: ModuleSources): ModuleRoots {
  const source = fs.realpathSync(params.sourceRoot);
  const repositories = params.repositoryRoots.map((file) =>
    fs.realpathSync(file),
  );
  const dependencies = resolutionOptions(
    source,
    params.moduleResolution,
  ).nodePaths.map((file) => {
    try {
      return fs.realpathSync(file);
    } catch {
      return path.resolve(file);
    }
  });
  const installation =
    params.moduleResolution.dependencyRoot === undefined
      ? undefined
      : fs.realpathSync(params.moduleResolution.dependencyRoot);
  return { source, repositories, dependencies, installation };
}
