import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build, transform } from "esbuild";

import { detail } from "./errors.js";
import { resolveImport } from "./importer-resolution.js";
import type { ModulePaths } from "./module-paths.js";
import { moduleContext } from "./postcss-context.js";
import { resolutionOptions } from "./resolution.js";

/** Repository presets are local modules; installed plugins remain native imports. */
export async function importPostcssModule(
  file: string,
  paths: ModulePaths,
): Promise<{ module: Record<string, unknown>; modules: string[] }> {
  const compiled = await build({
    absWorkingDir: path.dirname(file),
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    mainFields: ["main"],
    ...resolutionOptions(paths.sourceRoot, paths.settings),
    conditions: ["node", "node-addons", ...paths.settings.conditions],
    metafile: true,
    logLevel: "silent",
    plugins: [
      {
        name: "consumer-postcss",
        setup(builder) {
          builder.onResolve({ filter: /^mokly:postcss-context$/ }, () => ({
            path: fileURLToPath(
              new URL("./postcss-resolution.js", import.meta.url),
            ),
            external: true,
          }));
          builder.onResolve({ filter: /.*/ }, async (args) => {
            if (args.pluginData === "resolved") return;
            const resolved = await resolveImport(paths, builder, args.path, {
              resolveDir: args.resolveDir,
              kind: args.kind,
              pluginData: "resolved",
            });
            if (resolved.errors.length) return { errors: resolved.errors };
            try {
              const target = await paths.resolve(resolved.path);
              await paths.dependencyUsage.resolved(
                args.path,
                args.resolveDir,
                target,
              );
              if (path.isAbsolute(target) && paths.repositoryOwned(target))
                return { path: target };
              return {
                path:
                  path.isAbsolute(target) && args.kind !== "require-call"
                    ? pathToFileURL(target).href
                    : target,
                external: true,
              };
            } catch (error) {
              return { errors: [{ text: detail(error) }] };
            }
          });
          builder.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
            const extension = path.extname(args.path);
            const output = await transform(
              await fs.readFile(args.path, "utf8"),
              {
                loader: extension.includes("ts")
                  ? "ts"
                  : extension === ".jsx"
                    ? "jsx"
                    : "js",
                define: {
                  "import.meta.url": JSON.stringify(
                    pathToFileURL(args.path).href,
                  ),
                  "import.meta.dirname": JSON.stringify(
                    path.dirname(args.path),
                  ),
                  "import.meta.filename": JSON.stringify(args.path),
                  __dirname: JSON.stringify(path.dirname(args.path)),
                  __filename: JSON.stringify(args.path),
                },
              },
            );
            return {
              contents: moduleContext(output.code, args.path),
              loader: "js",
            };
          });
        },
      },
    ],
  });
  const code = moduleContext(compiled.outputFiles![0]!.text, file, true);
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  return {
    module,
    modules: Object.keys(compiled.metafile!.inputs).map((input) =>
      path.resolve(path.dirname(file), input),
    ),
  };
}
