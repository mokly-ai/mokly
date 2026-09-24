import type { Plugin } from "esbuild";

import type { ResolvedConfig } from "../../config/types.js";
import { MoklyError } from "../../errors.js";

import { moduleBindings } from "./modules.js";
import type { StylePreprocessor } from "./preprocess.js";

/** Graph-side CSS loader that retains local module bindings without CSS outputs. */
export class GraphStyles {
  private readonly errors = new Map<string, MoklyError>();

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
            return {
              contents: moduleBindings(prepared.scoped!.exports),
              loader: "js",
            };
          } catch (error) {
            const failure =
              error instanceof MoklyError
                ? error
                : new MoklyError("build-invalid", String(error));
            this.errors.set(arguments_.path, failure);
            return { errors: [{ text: failure.message }] };
          }
        });
      },
    };
  }
}
