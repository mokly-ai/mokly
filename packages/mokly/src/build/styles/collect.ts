import path from "node:path";

import type { Plugin } from "esbuild";

import { locatePath } from "../../config/file_locations.js";
import { toPosixPath } from "../../config/paths.js";
import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

import { recordFirstFailure } from "./failures.js";
import { moduleBindings } from "./modules.js";
import type { StylePreprocessor } from "./preprocess.js";

/** Graph-side CSS loader that retains local module bindings without CSS outputs. */
export class GraphStyles {
  private readonly errors = new Map<string, MoklyError>();
  /** JavaScript class maps for modules seen by the graph before renderer pruning. */
  readonly classMaps = new Map<string, Readonly<Record<string, string>>>();

  /** Report the first failure by stylesheet path, not callback completion order. */
  get failure(): MoklyError | undefined {
    return [...this.errors.entries()].sort(([first], [second]) =>
      first < second ? -1 : first > second ? 1 : 0,
    )[0]?.[1];
  }

  constructor(
    private readonly config: ResolvedConfig,
    readonly preprocessor: StylePreprocessor,
  ) {}

  /** Handle graph CSS imports without allowing esbuild to emit a sibling CSS file. */
  get plugin(): Plugin {
    return {
      name: "mokly-graph-styles",
      setup: (pluginBuild) => {
        pluginBuild.onResolve({ filter: /\.css$/ }, async (arguments_) => {
          if (
            arguments_.pluginData?.moklySkip ||
            arguments_.kind !== "import-statement" ||
            !arguments_.importer
          )
            return;
          const resolved = await pluginBuild.resolve(arguments_.path, {
            importer: arguments_.importer,
            resolveDir: arguments_.resolveDir,
            kind: "import-statement",
            pluginData: { moklySkip: true },
          });
          if (
            !resolved.errors.length &&
            !resolved.external &&
            resolved.path.endsWith(".css") &&
            !locatePath(resolved.path, this.config.repoRoot)
          ) {
            const failure = new MoklyError(
              "build-invalid",
              `CSS import is outside repoRoot in ${toPosixPath(path.relative(this.config.repoRoot, arguments_.importer))}: ${arguments_.path}; move the stylesheet inside repoRoot or remove the import`,
            );
            recordFirstFailure(this.errors, arguments_.importer, failure);
            return { errors: [{ text: failure.message }] };
          }
          return;
        });
        pluginBuild.onLoad({ filter: /\.css$/ }, async (arguments_) => {
          try {
            const module = arguments_.path.endsWith(".module.css");
            if (
              this.config.moduleResolution.loaders[".css"] === "empty" ||
              (module &&
                this.config.moduleResolution.loaders[".module.css"] === "empty")
            )
              return {
                contents: module ? "export default {};" : "",
                loader: "js",
              };
            if (!module) return { contents: "", loader: "js" };
            const prepared = await this.preprocessor.prepare(arguments_.path);
            this.classMaps.set(arguments_.path, prepared.scoped!.exports);
            return {
              contents: moduleBindings(prepared.scoped!.exports),
              loader: "js",
            };
          } catch (error) {
            const failure =
              error instanceof MoklyError
                ? error
                : new MoklyError("build-invalid", String(error));
            recordFirstFailure(this.errors, arguments_.path, failure);
            return { errors: [{ text: failure.message }] };
          }
        });
      },
    };
  }
}
