import fs from "node:fs/promises";
import path from "node:path";

import { build, type Plugin } from "esbuild";

import { isInside, toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { timeAsync } from "../../diagnostics/timings.js";
import { MoklyError, errorMessage } from "../../errors.js";
import { packageNodePaths } from "../consumer_resolution.js";

import { lightningTransform } from "./lightning.js";
import { scanImportPrelude } from "./prelude.js";
import type { StylePreprocessor } from "./preprocess.js";
import { StyleResolution } from "./resolution.js";

/** Inventory transformer-only CSS and URLs without bundling or emitting CSS. */
export async function inventoryTransformerStyles(
  config: ResolvedConfig,
  styles: readonly string[],
  graphInputs: ReadonlySet<string>,
  preprocessor: StylePreprocessor,
  delivered: ReadonlySet<string> = new Set(),
): Promise<ReadonlySet<string>> {
  const pending = styles.filter(
    (file) => !delivered.has(file) && !isPackageCss(file),
  );
  if (!pending.length) return new Set();
  return timeAsync("styles.inventory", async () => {
    const resolution = new StyleResolution(config, graphInputs);
    const closure = new Set<string>();
    let failure: MoklyError | undefined;
    const virtual = "mokly:transformer-styles-inventory";
    const plugin: Plugin = {
      name: "mokly-transformer-style-inventory",
      setup(pluginBuild) {
        const visit = async (file: string): Promise<void> => {
          if (closure.has(file) || delivered.has(file) || isPackageCss(file))
            return;
          closure.add(file);
          const original = await fs.readFile(file, "utf8");
          const prepared = await preprocessor.prepare(file);
          for (const text of [original, prepared.css]) {
            for (const entry of scanImportPrelude(text)) {
              const resolved = await resolution.resolveImport(
                pluginBuild,
                entry.specifier,
                file,
              );
              if (resolved) await visit(resolved);
            }
          }
          let dependencies;
          try {
            dependencies =
              lightningTransform()({
                filename: toPosixPath(path.relative(config.repoRoot, file)),
                code: Buffer.from(prepared.css),
                analyzeDependencies: true,
                errorRecovery: true,
                minify: false,
              }).dependencies ?? [];
          } catch (error) {
            throw new MoklyError(
              "build-invalid",
              `could not transform CSS ${toPosixPath(path.relative(config.repoRoot, file))}: ${errorMessage(error)}; fix the stylesheet and rebuild`,
              { cause: error },
            );
          }
          for (const dependency of dependencies) {
            if (dependency.type === "url")
              resolution.validateAsset(dependency.url, file);
          }
        };
        pluginBuild.onResolve(
          { filter: /^mokly:transformer-styles-inventory$/ },
          () => ({
            path: virtual,
            namespace: "mokly-transformer-inventory",
          }),
        );
        pluginBuild.onLoad(
          { filter: /.*/, namespace: "mokly-transformer-inventory" },
          () => ({
            contents: "export {};",
            loader: "js",
          }),
        );
        pluginBuild.onStart(async () => {
          try {
            for (const file of pending) await visit(file);
            return {};
          } catch (error) {
            failure =
              error instanceof MoklyError
                ? error
                : new MoklyError("build-invalid", errorMessage(error));
            return { errors: [{ text: failure.message }] };
          }
        });
      },
    };
    try {
      await build({
        absWorkingDir: config.repoRoot,
        alias: config.moduleResolution.aliases,
        bundle: true,
        conditions: ["style", ...(config.moduleResolution.conditions ?? [])],
        entryPoints: [virtual],
        logLevel: "silent",
        mainFields: [
          "style",
          ...(config.moduleResolution.mainFields ?? ["main", "module"]),
        ],
        nodePaths: packageNodePaths(config),
        outfile: path.join(config.repoRoot, ".mokly-transformer-analysis.js"),
        platform: "node",
        plugins: [plugin, resolution.plugin],
        preserveSymlinks: true,
        ...(config.moduleResolution.resolveExtensions
          ? {
              resolveExtensions: [...config.moduleResolution.resolveExtensions],
            }
          : {}),
        write: false,
      });
    } catch (error) {
      if (failure || resolution.failure) throw failure ?? resolution.failure;
      throw new MoklyError("build-invalid", errorMessage(error), {
        cause: error,
      });
    }
    return new Set(
      [...closure, ...resolution.assets].filter(
        (file) =>
          isInside(config.repoRoot, file) &&
          !path
            .relative(config.repoRoot, file)
            .split(path.sep)
            .includes("node_modules"),
      ),
    );
  });
}

function isPackageCss(file: string): boolean {
  return file.split(path.sep).includes("node_modules");
}
