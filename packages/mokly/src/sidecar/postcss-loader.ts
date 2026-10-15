import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build, transform } from "esbuild";
import type { Loader } from "esbuild";
import postcss from "postcss";
import type { AcceptedPlugin } from "postcss";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

import { detail } from "./errors.js";
import { moduleContext } from "./postcss-context.js";
import { plainObject, resolvePlugin } from "./postcss-resolution.js";
import { resolutionOptions } from "./resolution.js";

/** Bundle local config helpers while packages keep consumer import conditions. */
export async function loadPostcss(
  file: string,
  sourceRoot: string,
  settings: ModuleResolution,
): Promise<{ processor: ReturnType<typeof postcss>; modules: string[] }> {
  const compiled = await build({
    absWorkingDir: path.dirname(file),
    entryPoints: [file],
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    mainFields: ["main"],
    ...resolutionOptions(sourceRoot, settings),
    conditions: ["node", "node-addons", ...settings.conditions],
    metafile: true,
    logLevel: "silent",
    plugins: [
      {
        name: "consumer-postcss",
        setup(build) {
          build.onResolve({ filter: /^mokly:postcss-context$/ }, () => ({
            path: fileURLToPath(
              new URL("./postcss-resolution.js", import.meta.url),
            ),
            external: true,
          }));
          build.onResolve({ filter: /^[^./]|^node:/ }, async (args) => {
            if (args.kind === "entry-point" || args.pluginData === "resolved")
              return;
            const resolved = await build.resolve(args.path, {
              resolveDir: args.resolveDir,
              kind: args.kind,
              pluginData: "resolved",
            });
            return {
              ...resolved,
              path:
                path.isAbsolute(resolved.path) && args.kind !== "require-call"
                  ? pathToFileURL(resolved.path).href
                  : resolved.path,
              namespace: "",
              external: true,
            };
          });
          build.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, async (args) => {
            const extension = path.extname(args.path);
            const source = await fs.readFile(args.path, "utf8");
            const output = await transform(source, {
              loader: extension.includes("ts")
                ? "ts"
                : extension === ".jsx"
                  ? "jsx"
                  : "js",
              define: {
                "import.meta.url": JSON.stringify(
                  pathToFileURL(args.path).href,
                ),
                "import.meta.dirname": JSON.stringify(path.dirname(args.path)),
                "import.meta.filename": JSON.stringify(args.path),
                __dirname: JSON.stringify(path.dirname(args.path)),
                __filename: JSON.stringify(args.path),
              },
            });
            return {
              contents: moduleContext(output.code, args.path),
              loader: "js" as Loader,
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
        const imported = await import(
          pathToFileURL(await resolvePlugin(name, file)).href
        );
        const factory = imported.default ?? imported;
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
    modules: Object.keys(compiled.metafile!.inputs).map((input) =>
      path.resolve(path.dirname(file), input),
    ),
  };
}
