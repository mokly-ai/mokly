import { pathToFileURL } from "node:url";

import type { ModulePaths } from "./module-paths.js";
import type { loadVite } from "./vite-peers.js";
import { fetchViteImport } from "./vite-resolution.js";
import { viteFile } from "./vite-urls.js";

/** Match Vite's config runner while routing its external fetches through this side. */
export async function runViteConfig(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  file: string,
  paths: ModulePaths,
) {
  const config = await vite.resolveConfig(
    {
      configFile: false,
      envDir: false,
      root: directory,
      logLevel: "silent",
      cacheDir: directory,
      environments: {
        inline: {
          consumer: "server",
          dev: { moduleRunnerTransform: true },
          resolve: {
            external: true,
            mainFields: [],
            conditions: ["node", "module-sync"],
          },
        },
      },
    },
    "serve",
  );
  const environment = vite.createRunnableDevEnvironment("inline", config, {
    hot: false,
    runnerOptions: { hmr: false },
  });
  const fetch = environment.fetchModule.bind(environment);
  environment.fetchModule = async (...args) => {
    const result = await fetchViteImport(paths, fetch, ...args);
    if (!("externalize" in result)) return result;
    const file = viteFile(result.externalize);
    if (!file) return result;
    const confined = await paths.resolve(file);
    if (paths.repositoryOwned(confined))
      return fetch(confined, args[1], args[2]);
    return { ...result, externalize: pathToFileURL(confined).href };
  };
  await environment.init();
  try {
    const module = await environment.runner.import<{ default: unknown }>(file);
    const dependencies = [
      ...environment.runner.evaluatedModules.urlToIdModuleMap.values(),
    ]
      .filter(
        (record) =>
          record.meta &&
          !("externalize" in record.meta) &&
          record.exports !== module,
      )
      .map((record) => record.file);
    return { module, dependencies };
  } finally {
    await environment.close();
  }
}
