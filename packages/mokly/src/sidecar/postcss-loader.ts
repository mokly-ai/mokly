import postcss from "postcss";
import type { AcceptedPlugin } from "postcss";

import { detail } from "./errors.js";
import type { ModulePaths } from "./module-paths.js";
import { attributed } from "./postcss-attribution.js";
import { PostcssError } from "./postcss-errors.js";
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
  const loaded = await importPostcssModule(file, paths).catch(
    (error: unknown) => {
      throw new PostcssError({
        kind: "load",
        module: paths.name(file),
        detail: detail(error),
      });
    },
  );
  const { module, modules } = loaded;
  const config: unknown = module.default;
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new PostcssError({
      kind: "load",
      module: paths.name(file),
      detail: "invalid default export",
    });
  for (const key of Object.keys(config))
    if (key !== "plugins" && key !== "map")
      throw new PostcssError({ kind: "key", key });
  const plugins = (config as { plugins?: unknown }).plugins;
  const accepted: AcceptedPlugin[] = [];
  if (Array.isArray(plugins)) {
    for (const [index, plugin] of plugins.entries()) {
      try {
        accepted.push(...postcss([plugin]).plugins);
      } catch (error) {
        throw new PostcssError({
          kind: "arrayPlugin",
          index,
          detail: detail(error),
        });
      }
    }
  } else if (plainObject(plugins)) {
    for (const [name, options] of Object.entries(plugins)) {
      if (!plainObject(options))
        throw new PostcssError({ kind: "options", plugin: name });
      try {
        const imported = await importPlugin(await resolvePlugin(name, file));
        const factory = imported.default ?? imported;
        if (typeof factory !== "function")
          throw new Error("plugin export is not a factory");
        accepted.push(...postcss([factory(options)]).plugins);
      } catch (error) {
        throw new PostcssError({
          kind: "factory",
          plugin: name,
          module: paths.name(file),
          detail: detail(error),
        });
      }
    }
  } else throw new PostcssError({ kind: "plugins" });
  return {
    processor: postcss(postcss(accepted).plugins.map(attributed)),
    modules,
  };
}
