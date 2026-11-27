import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

import type { PostcssDependencySource } from "../generated/sidecar/PostcssDependencySource.js";

import { detail } from "./errors.js";
import { importPath, resolveImport } from "./importer-resolution.js";
import { MetafileEdges } from "./metafile-edges.js";
import type { ModulePaths } from "./module-paths.js";
import { moduleContext } from "./postcss-context.js";
import { postcssSource } from "./postcss-source.js";
import { resolutionOptions } from "./resolution.js";
import { bareSpecifier } from "./specifier.js";

type Entry = { kind: "configured" } | { kind: "import"; specifier: string };

const importedInputs = new Map<string, PostcssDependencySource>();

/** Classify a dependency already recorded by a PostCSS bundle. */
export function bundledPostcssSource(
  file: string,
): PostcssDependencySource | undefined {
  return importedInputs.get(file);
}

/** Repository presets are local modules; installed plugins remain native imports. */
export async function importPostcssModule(
  file: string,
  paths: ModulePaths,
  entry: Entry,
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
              const target = await importPath(paths, args.path, resolved);
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
          builder.onLoad({ filter: /.*/ }, (args) =>
            postcssSource(args.path, paths.settings.loaders),
          );
        },
      },
    ],
  });
  const code = moduleContext(compiled.outputFiles![0]!.text, file, true);
  const module = await import(
    `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`
  );
  const modules = Object.keys(compiled.metafile!.inputs).map((input) =>
    path.resolve(path.dirname(file), input),
  );
  const packages = new MetafileEdges(
    compiled.metafile!,
    path.dirname(file),
  ).packageImports();
  for (const input of modules) {
    if (input === file && entry.kind === "configured") continue;
    const byPackage =
      packages.has(input) ||
      (input === file &&
        entry.kind === "import" &&
        bareSpecifier(entry.specifier));
    if (byPackage || !importedInputs.has(input))
      importedInputs.set(
        input,
        byPackage ? "bundled-package-import" : "bundled-import",
      );
  }
  return { module, modules };
}
