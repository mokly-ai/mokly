import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { build, transform, type Metafile, type Plugin } from "esbuild";
import postcss, { type AcceptedPlugin } from "postcss";

import { graphSourceFiles } from "../build/source_inventory.js";
import { MoklyError, errorMessage } from "../errors.js";

import type { ResolvedConfig } from "./types.js";

/** Normalized elements accepted by PostCSS's processor. */
export type NormalizedPostcssPlugin = ReturnType<
  typeof postcss
>["plugins"][number];

/** Analyze and evaluate PostCSS modules without changing Mokly config loading. */
export interface PostcssConfigLoader {
  /** Only local module inputs become private, watched configuration sources. */
  analyze(config: ResolvedConfig): Promise<readonly string[]>;
  /** Evaluate once per graph load, preserving package-native modules. */
  load(config: ResolvedConfig): Promise<readonly NormalizedPostcssPlugin[]>;
}

/** Filesystem-backed PostCSS module loader. */
export class FileSystemPostcssConfigLoader implements PostcssConfigLoader {
  /** Collect local PostCSS imports without running consumer code. */
  async analyze(config: ResolvedConfig): Promise<readonly string[]> {
    if (!config.postcss) return [];
    const result = await bundleModule(config.postcss, config.configPath);
    return graphSourceFiles(
      result.metafile,
      path.dirname(config.postcss),
      config.repoRoot,
      config.mockupsDir,
    );
  }

  /** Import fresh local code and construct plugin instances in this process. */
  async load(
    config: ResolvedConfig,
  ): Promise<readonly NormalizedPostcssPlugin[]> {
    if (!config.postcss) return [];
    const location = config.postcss;
    let exported: unknown;
    const temporary = await fs.mkdtemp(
      path.join(os.tmpdir(), "mokly-postcss-"),
    );
    try {
      const bundle = await bundleModule(location, config.configPath);
      const file = path.join(temporary, "postcss.mjs");
      await fs.writeFile(file, bundle.code);
      const module = (await import(pathToFileURL(file).href)) as {
        default?: unknown;
      };
      exported = module.default;
    } catch (error) {
      if (error instanceof MoklyError) throw error;
      throw new MoklyError(
        "config-invalid",
        `could not load postcss module ${path.relative(path.dirname(config.configPath), location).split(path.sep).join("/")}: ${errorMessage(error)}; default-export an object with plugins`,
        { cause: error },
      );
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
    return normalizePlugins(exported, location, config.configPath);
  }
}

async function bundleModule(
  entry: string,
  configPath: string,
): Promise<{ code: string; metafile: Metafile }> {
  try {
    const result = await build({
      absWorkingDir: path.dirname(entry),
      bundle: true,
      conditions: ["node", "import", "default"],
      entryPoints: [entry],
      format: "esm",
      logLevel: "silent",
      metafile: true,
      outfile: path.join(os.tmpdir(), "mokly-postcss-analysis.mjs"),
      platform: "node",
      plugins: [postcssImports()],
      target: "node22",
      write: false,
    });
    return { code: result.outputFiles![0]!.text, metafile: result.metafile! };
  } catch (error) {
    throw new MoklyError(
      "config-invalid",
      `could not load postcss module ${path.relative(path.dirname(configPath), entry).split(path.sep).join("/")}: ${errorMessage(error)}; default-export an object with plugins`,
      { cause: error },
    );
  }
}

function postcssImports(): Plugin {
  return {
    name: "mokly-postcss-imports",
    setup(pluginBuild) {
      pluginBuild.onResolve({ filter: /.*/ }, async (arguments_) => {
        if (arguments_.pluginData?.skipPackageResolve) return;
        if (!isBareImport(arguments_.path)) return;
        if (arguments_.path.startsWith("node:"))
          return { path: arguments_.path, external: true };
        const resolved = await pluginBuild.resolve(arguments_.path, {
          importer: arguments_.importer,
          resolveDir: arguments_.resolveDir,
          kind: "import-statement",
          pluginData: { skipPackageResolve: true },
        });
        if (resolved.errors.length) return { errors: resolved.errors };
        return {
          path: resolved.external
            ? resolved.path
            : pathToFileURL(resolved.path).href,
          external: true,
        };
      });
      pluginBuild.onLoad({ filter: /\.[cm]?[jt]s$/ }, async (arguments_) => {
        const code = await fs.readFile(arguments_.path, "utf8");
        const physical = await fs.realpath(arguments_.path);
        const extension = path.extname(arguments_.path);
        const compiled = await transform(code, {
          define: {
            "import.meta.url": JSON.stringify(pathToFileURL(physical).href),
            "import.meta.dirname": JSON.stringify(path.dirname(physical)),
            "import.meta.filename": JSON.stringify(physical),
          },
          loader: extension === ".ts" || extension === ".mts" ? "ts" : "js",
          target: "node22",
        });
        return {
          contents: compiled.code,
          loader: "js",
          resolveDir: path.dirname(arguments_.path),
        };
      });
    },
  };
}

function isBareImport(specifier: string): boolean {
  return !specifier.startsWith(".") && !path.isAbsolute(specifier);
}

async function resolvePluginPackage(
  name: string,
  directory: string,
): Promise<string> {
  let resolved: string | undefined;
  await build({
    bundle: true,
    conditions: ["node", "import", "default"],
    stdin: {
      contents: `import ${JSON.stringify(name)};`,
      resolveDir: directory,
    },
    platform: "node",
    format: "esm",
    logLevel: "silent",
    outfile: path.join(os.tmpdir(), "mokly-postcss-package.mjs"),
    plugins: [
      {
        name: "mokly-postcss-package",
        setup(pluginBuild) {
          pluginBuild.onResolve({ filter: /.*/ }, async (arguments_) => {
            if (arguments_.pluginData?.skip) return;
            const result = await pluginBuild.resolve(arguments_.path, {
              importer: arguments_.importer,
              resolveDir: arguments_.resolveDir,
              kind: "import-statement",
              pluginData: { skip: true },
            });
            if (result.errors.length) return { errors: result.errors };
            resolved = result.path;
            return { path: result.path, external: true };
          });
        },
      },
    ],
    write: false,
  });
  if (!resolved) throw new Error(`could not resolve ${name}`);
  return pathToFileURL(resolved).href;
}

async function normalizePlugins(
  value: unknown,
  modulePath: string,
  configPath: string,
): Promise<readonly NormalizedPostcssPlugin[]> {
  const relative = path
    .relative(path.dirname(configPath), modulePath)
    .split(path.sep)
    .join("/");
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new MoklyError(
      "config-invalid",
      `could not load postcss module ${relative}: missing default export object; default-export an object with plugins`,
    );
  const settings = value as Record<string, unknown>;
  for (const key of Object.keys(settings))
    if (key !== "plugins" && key !== "map")
      throw new MoklyError(
        "config-invalid",
        `postcss configuration has unsupported key: ${key}; only plugins and map are supported`,
      );
  const plugins = settings.plugins;
  if (!plugins || typeof plugins !== "object")
    throw new MoklyError(
      "config-invalid",
      "postcss plugins must be an array of plugin instances or an object mapping package names to option objects",
    );
  if (Array.isArray(plugins))
    return plugins.flatMap((plugin: unknown, index: number) => {
      try {
        return postcss([plugin as AcceptedPlugin]).plugins;
      } catch (error) {
        throw new MoklyError(
          "config-invalid",
          `postcss plugins[${index}] is not a PostCSS 8 plugin: ${errorMessage(error)}; use a plugin instance, creator, function or object with a postcss factory`,
          { cause: error },
        );
      }
    });
  if (!isPlainObject(plugins))
    throw new MoklyError(
      "config-invalid",
      "postcss plugins must be an array of plugin instances or an object mapping package names to option objects",
    );
  const instances: NormalizedPostcssPlugin[] = [];
  for (const [name, options] of Object.entries(plugins)) {
    if (!isPlainObject(options))
      throw new MoklyError(
        "config-invalid",
        `postcss plugins[${name}] must be a plain option object`,
      );
    try {
      const imported = (await import(
        await resolvePluginPackage(name, path.dirname(modulePath))
      )) as { default?: unknown };
      if (typeof imported.default !== "function")
        throw new Error("package must default-export a plugin factory");
      const plugin: unknown = imported.default(options);
      instances.push(...postcss([plugin as AcceptedPlugin]).plugins);
    } catch (error) {
      throw new MoklyError(
        "config-invalid",
        `could not load PostCSS plugin ${name} from ${relative}: ${errorMessage(error)}; install and configure it in the consumer repository`,
        { cause: error },
      );
    }
  }
  return instances;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
