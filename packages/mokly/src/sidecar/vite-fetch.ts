import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { ViteDevServer } from "vite";

import type { ViteExternalType } from "../generated/sidecar/ViteExternalType.js";
import type { ViteFetchResult } from "../generated/sidecar/ViteFetchResult.js";

import { viteFailure } from "./vite-errors.js";
import { viteExternalFile } from "./vite-external.js";
import { recordViteInput } from "./vite-inputs.js";
import type { ViteInputs } from "./vite-plugin.js";
import { fetchViteImport } from "./vite-resolution.js";
import { viteFile, viteId, viteJsx, viteUrl } from "./vite-urls.js";

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
  retainedFiles: ReadonlyMap<string, Uint8Array> = new Map(),
): ViteFetch {
  const environment = server.environments.ssr!;
  const mokly = new Set(
    server.config.plugins.filter((plugin) => plugin.name === "mokly"),
  );
  return async (url, importer) => {
    try {
      const id = viteId(url);
      if (id.startsWith(input.runtimeKey))
        return { externalize: id, type: "module" };
      const external = viteExternalFile(id);
      if (external) {
        const file = await input.paths.resolve(external);
        await recordViteInput(input, file);
        return {
          externalize: pathToFileURL(file).href,
          type: await externalType(file),
        };
      }
      if (
        /^(react|react-dom)(?:\/|$)/.test(id) &&
        id !== "react/jsx-dev-runtime"
      ) {
        const file = await input.paths.resolve(
          await input.require.resolvePeer(id),
        );
        await recordViteInput(input, file);
        return {
          externalize: pathToFileURL(file).href,
          type: file.endsWith(".mjs") ? "module" : "commonjs",
        };
      }
      let requested =
        id === "react/jsx-dev-runtime" ? viteUrl(viteJsx) : viteUrl(url);
      if (id === "@mokly/mokly") {
        const facade = await environment.pluginContainer.resolveId(
          id,
          importer,
        );
        if (!facade)
          throw new Error("could not resolve @mokly/mokly authoring facade");
        requested = viteUrl(facade.id);
      }
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
      } else {
        const style = await input.styles.resolve(
          id,
          importer,
          (source, importer) =>
            environment.pluginContainer.resolveId(source, importer, {
              skip: mokly,
            }),
        );
        if (typeof style === "string") requested = viteUrl(style);
      }
      let result = await fetchViteImport(
        input.paths,
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

async function externalType(file: string): Promise<ViteExternalType> {
  if (/\.(mjs|mts)$/.test(file)) return "module";
  if (/\.(cjs|cts)$/.test(file)) return "commonjs";
  let directory = path.dirname(file);
  for (;;) {
    try {
      const manifest: unknown = JSON.parse(
        await fs.readFile(path.join(directory, "package.json"), "utf8"),
      );
      return manifest &&
        typeof manifest === "object" &&
        "type" in manifest &&
        manifest.type === "module"
        ? "module"
        : "commonjs";
    } catch (error) {
      if (!(
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
    const parent = path.dirname(directory);
    if (parent === directory) return "commonjs";
    directory = parent;
  }
}
