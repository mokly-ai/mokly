import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import type { build } from "esbuild";
import type * as Vite from "vite";

import type { BundleParams } from "../generated/sidecar/BundleParams.js";

import { ModulePaths } from "./module-paths.js";
import { consumerRequire } from "./paths.js";
import type { ConsumerRequire } from "./paths.js";
import { resolutionOptions } from "./resolution.js";

/** Keep the existing consumer peer resolver alive during the Vite compile. */
export async function withVitePeers<T>(
  params: BundleParams,
  compile: typeof build,
  run: (require: ConsumerRequire) => Promise<T>,
): Promise<T> {
  const settings = {
    ...params.moduleResolution,
    aliases: {},
    conditions: [],
    mainFields: [],
    resolveExtensions: [],
    loaders: {},
  };
  const require = await consumerRequire(
    { ...params, moduleResolution: settings },
    await ModulePaths.create({ ...params, moduleResolution: settings }),
  );
  let outcome: { value: T } | { error: unknown } | undefined;
  await compile({
    absWorkingDir: path.resolve(
      params.sourceRoot,
      params.configurationDirectory,
    ),
    stdin: {
      contents: 'import "mokly-vite-peers";',
      resolveDir: params.sourceRoot,
    },
    bundle: true,
    write: false,
    platform: "node",
    tsconfigRaw: { compilerOptions: {} },
    logLevel: "silent",
    ...resolutionOptions(params.sourceRoot, settings),
    plugins: [
      require.peerPlugin,
      {
        name: "mokly-vite-peers",
        setup(builder) {
          builder.onResolve({ filter: /^mokly-vite-peers$/ }, () => ({
            path: "peers",
            namespace: "mokly-vite-peers",
          }));
          builder.onLoad(
            { filter: /.*/, namespace: "mokly-vite-peers" },
            async () => {
              try {
                await require.resolvePeer("vite");
                await require.resolvePeer("vite/module-runner");
                await require.resolvePeer("vite/package.json");
                outcome = { value: await run(require) };
              } catch (error) {
                outcome = { error };
              }
              return { contents: "" };
            },
          );
        },
      },
    ],
  });
  if (!outcome) throw new Error("vite: consumer peer resolution did not run");
  if ("error" in outcome) throw outcome.error;
  return outcome.value;
}

/** Load the side's optional peer and identify its selected installation. */
export async function loadVite(require: ConsumerRequire) {
  const file = require.resolve("vite");
  const api: typeof Vite = await import(pathToFileURL(file).href);
  const root = await fs.realpath(
    path.dirname(require.resolve("vite/package.json")),
  );
  return { api, root };
}
