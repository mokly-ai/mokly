import postcss from "postcss";
import type { AcceptedPlugin } from "postcss";

import { detail } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { importPostcssModule } from "./postcss-module.js";
import {
  importPlugin,
  plainObject,
  resolvePlugin,
} from "./postcss-resolution.js";

/** Bundle local config helpers while packages keep consumer import conditions. */
export async function loadPostcss(
  file: string,
  paths: ModulePaths,
): Promise<{ processor: ReturnType<typeof postcss>; modules: string[] }> {
  const { module, modules } = await importPostcssModule(file, paths);
  const config: unknown = module.default;
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error(
      `could not load postcss module ${file}: invalid default export; default-export an object with plugins`,
    );
  for (const key of Object.keys(config))
    if (key !== "plugins" && key !== "map")
      throw new Error(
        `postcss configuration has unsupported key: ${key}; only plugins and map are supported`,
      );
  const plugins = (config as { plugins?: unknown }).plugins;
  const accepted: AcceptedPlugin[] = [];
  if (Array.isArray(plugins)) {
    for (const [index, plugin] of plugins.entries()) {
      try {
        accepted.push(...postcss([plugin]).plugins);
      } catch (error) {
        throw new Error(
          `postcss plugins[${index}] is not a PostCSS 8 plugin: ${detail(error)}; use a plugin instance, creator, function or object with a postcss factory`,
          { cause: error },
        );
      }
    }
  } else if (plainObject(plugins)) {
    for (const [name, options] of Object.entries(plugins)) {
      if (!plainObject(options))
        throw new Error(
          `postcss plugins[${name}] must be a plain option object`,
        );
      try {
        const imported = await importPlugin(await resolvePlugin(name, file));
        const factory = imported.default ?? imported;
        if (typeof factory !== "function")
          throw new Error("plugin export is not a factory");
        accepted.push(...postcss([factory(options)]).plugins);
      } catch (error) {
        throw new Error(
          `could not load PostCSS plugin ${name} from ${file}: ${detail(error)}; install and configure it in the consumer repository`,
          { cause: error },
        );
      }
    }
  } else
    throw new Error(
      "postcss plugins must be an array of plugin instances or an object mapping package names to option objects",
    );
  return {
    processor: postcss(accepted),
    modules,
  };
}
