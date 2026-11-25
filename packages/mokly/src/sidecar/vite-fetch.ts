import { pathToFileURL } from "node:url";

import type { ViteDevServer } from "vite";

import type { ViteFetchResult } from "../generated/sidecar/ViteFetchResult.js";

import { viteFailure } from "./vite-errors.js";
import { externalType, viteExternalFile } from "./vite-external.js";
import { recordViteInput } from "./vite-inputs.js";
import type { VitePluginReports } from "./vite-plugin-inputs.js";
import { resolveViteLibrary } from "./vite-plugin.js";
import type { ViteInputs } from "./vite-plugin.js";
import { fetchViteImport } from "./vite-resolution.js";
import { viteEntry, viteFile, viteId, viteUrl } from "./vite-urls.js";

export type ViteFetch = (
  url: string,
  importer?: string,
) => Promise<ViteFetchResult>;

/** The only server fetch boundary; a future router can select a server here. */
export function createViteFetch(
  server: ViteDevServer,
  input: ViteInputs,
  imports: Map<string, string[]>,
  version: string,
  reports: VitePluginReports,
  retainedFiles: ReadonlyMap<string, Uint8Array> = new Map(),
): ViteFetch {
  const environment = server.environments.ssr!;
  return async (url, importer) => {
    try {
      const id = viteId(url);
      if (id.startsWith(input.runtimeKey))
        return { externalize: id, type: "module" };
      const library = await resolveViteLibrary(input, id, importer);
      const external = viteExternalFile(library ?? id);
      if (external) {
        const file = await input.paths.resolve(external);
        await recordViteInput(input, file);
        return {
          externalize: pathToFileURL(file).href,
          type: await externalType(file),
        };
      }
      let requested = viteUrl(library ?? url);
      const original = input.styles.original(id, importer);
      if (original) {
        const file = await input.paths.resolve(original.id);
        if (original.external && !input.paths.repositoryOwned(file)) {
          await recordViteInput(input, file);
          return {
            externalize: pathToFileURL(file).href,
            type: await externalType(file),
          };
        }
        requested = viteUrl(file);
      }
      const native =
        requested === viteUrl(url) && importer !== viteEntry
          ? await input.external(id, importer)
          : undefined;
      let result = native
        ? {
            externalize: pathToFileURL(native).href,
            type: await externalType(native),
          }
        : await fetchViteImport(
            input.lookup,
            environment.fetchModule.bind(environment),
            requested,
            importer,
            {
              cached: false,
            },
          );
      if ("cache" in result)
        throw new Error("uncached Vite fetch returned no code");
      if ("externalize" in result) {
        const file = viteFile(result.externalize);
        if (file) {
          const confined = await input.paths.resolve(file);
          if (input.paths.repositoryOwned(confined)) {
            result = await environment.fetchModule(
              viteUrl(confined),
              importer,
              { cached: false },
            );
            if ("cache" in result)
              throw new Error("uncached Vite fetch returned no code");
          } else {
            result.externalize = pathToFileURL(confined).href;
            await recordViteInput(input, confined);
          }
        }
      }
      if ("code" in result) {
        const physical = viteFile(result.id);
        const file = physical && (await input.paths.resolve(physical));
        if (file && !input.files.has(file)) {
          const bytes = retainedFiles.get(file);
          if (!bytes)
            throw new Error("Vite transform has no consumed source bytes");
          input.files.set(file, bytes);
        }
        const transformed = environment.moduleGraph.getModuleById(
          result.id,
        )?.transformResult;
        imports.set(result.id, [
          ...(transformed?.deps ?? []),
          ...(transformed?.dynamicDeps ?? []),
        ]);
        for (const [file, digest] of reports.forModule(environment, result.id))
          if (!input.pluginInputs.has(file))
            input.pluginInputs.set(file, digest);
        if (
          file &&
          physical &&
          result.id.startsWith(physical) &&
          file !== physical
        ) {
          const edges = imports.get(result.id)!;
          result.id = file + result.id.slice(physical.length);
          imports.set(result.id, edges);
        }
      }
      return result;
    } catch (error) {
      throw viteFailure(error, input.paths, importer ?? url, version);
    }
  };
}
