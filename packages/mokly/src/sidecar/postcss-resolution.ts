import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build, transformSync } from "esbuild";

import { detail } from "./errors.js";
import { importerDirectory, resolveImport } from "./importer-resolution.js";
import { ModulePaths } from "./module-paths.js";
import type { ModuleSources } from "./module-paths.js";
import { moduleBytes } from "./postcss-evidence.js";
import { resolutionOptions } from "./resolution.js";

let sources: ModulePaths;
const dynamicFiles = new Set<string>();
const commonJs = new Map<string, { exports: unknown }>();

export async function configureResolution(
  params: ModuleSources,
): Promise<ModulePaths> {
  sources = await ModulePaths.create(params);
  return sources;
}

/** Record-form and dynamic imports use the side's import conditions and mapping. */
export async function resolvePlugin(
  name: string,
  file: string,
): Promise<string> {
  let resolvedPath: string | undefined;
  await build({
    absWorkingDir: path.dirname(file),
    stdin: {
      contents: `import ${JSON.stringify(name)};`,
      resolveDir: path.dirname(file),
    },
    bundle: true,
    write: false,
    platform: "node",
    mainFields: ["main"],
    ...resolutionOptions(sources.sourceRoot, sources.settings),
    conditions: ["node", "node-addons", ...sources.settings.conditions],
    logLevel: "silent",
    plugins: [
      {
        name: "postcss-record",
        setup(builder) {
          builder.onResolve({ filter: /.*/ }, async (args) => {
            if (args.pluginData === "resolved") return;
            const resolved = await resolveImport(sources, builder, args.path, {
              resolveDir: args.resolveDir,
              kind: "import-statement",
              pluginData: "resolved",
            });
            if (resolved.errors.length) return { errors: resolved.errors };
            try {
              resolvedPath = await sources.resolve(resolved.path);
              await sources.dependencyUsage.resolved(
                name,
                path.dirname(file),
                resolvedPath,
              );
              return { path: resolvedPath, external: true };
            } catch (error) {
              return { errors: [{ text: detail(error) }] };
            }
          });
        },
      },
    ],
  });
  if (!resolvedPath)
    throw new Error(`could not resolve PostCSS plugin ${name}`);
  return resolvedPath;
}

export async function importPlugin(
  file: string,
): Promise<Record<string, unknown>> {
  if (path.isAbsolute(file) && sources.repositoryOwned(file)) {
    const { importPostcssModule } = await import("./postcss-module.js");
    const { module, modules } = await importPostcssModule(file, sources);
    modules.forEach((file) => dynamicFiles.add(file));
    return module;
  }
  return import(path.isAbsolute(file) ? pathToFileURL(file).href : file);
}

function nativePath(
  name: string,
  file: string,
  options?: { paths?: string[] },
): string {
  const authored = name;
  const alias = Object.keys(sources.settings.aliases)
    .sort((a, b) => b.length - a.length)
    .find((key) => name === key || name.startsWith(key + "/"));
  if (alias) name = sources.settings.aliases[alias] + name.slice(alias.length);
  const native = createRequire(
    path.join(
      importerDirectory(sources, name, path.dirname(file)),
      path.basename(file),
    ),
  );
  let resolved: string;
  try {
    resolved = native.resolve(name, options);
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      !("code" in error) ||
      error.code !== "MODULE_NOT_FOUND"
    )
      throw error;
    let found: string | undefined;
    for (const root of sources.dependencyRoots) {
      try {
        found = createRequire(
          path.join(path.dirname(root), "package.json"),
        ).resolve(name, options);
        break;
      } catch (next) {
        if (
          !next ||
          typeof next !== "object" ||
          !("code" in next) ||
          next.code !== "MODULE_NOT_FOUND"
        )
          throw next;
      }
    }
    if (!found) throw error;
    resolved = found;
  }
  const mapped = sources.resolveSync(resolved);
  sources.dependencyUsage.resolvedSync(authored, path.dirname(file), mapped);
  return mapped;
}

function requireLocal(file: string): unknown {
  const cached = commonJs.get(file);
  if (cached) return cached.exports;
  if (path.extname(file) === ".json") {
    dynamicFiles.add(file);
    return createRequire(file)(file);
  }
  const module = { exports: {} };
  commonJs.set(file, module);
  dynamicFiles.add(file);
  try {
    const code = transformSync(moduleBytes(file).toString(), {
      loader: /\.[cm]?tsx?$/.test(file) ? "ts" : "js",
      format: "cjs",
      sourcefile: file,
      define: {
        "import.meta.url": JSON.stringify(pathToFileURL(file).href),
        "import.meta.dirname": JSON.stringify(path.dirname(file)),
        "import.meta.filename": JSON.stringify(file),
      },
    }).code;
    new Function(
      "module",
      "exports",
      "require",
      "__dirname",
      "__filename",
      code,
    )(module, module.exports, context(file).require, path.dirname(file), file);
    return module.exports;
  } catch (error) {
    commonJs.delete(file);
    throw error;
  }
}

/** Keep synchronous requires and asynchronous imports rooted at the mapped module. */
export function context(file: string) {
  const native = createRequire(file);
  const resolve = (name: string, options?: { paths?: string[] }) =>
    nativePath(name, file, options);
  const require = Object.assign(
    (name: string) => {
      if (
        name ===
        fileURLToPath(new URL("./postcss-resolution.js", import.meta.url))
      )
        return { context };
      const target = resolve(name);
      return path.isAbsolute(target) && sources.repositoryOwned(target)
        ? requireLocal(target)
        : native(target);
    },
    native,
    { resolve },
  );
  return {
    require,
    async import(value: unknown, options?: ImportCallOptions) {
      const name = String(value);
      const resolved = name.startsWith("file:")
        ? await sources.resolve(fileURLToPath(name))
        : /^(node|data):/.test(name)
          ? name
          : await resolvePlugin(name, file);
      if (path.isAbsolute(resolved)) dynamicFiles.add(resolved);
      if (options)
        return import(
          path.isAbsolute(resolved) ? pathToFileURL(resolved).href : resolved,
          options
        );
      return importPlugin(resolved);
    },
  };
}

export function loadedFiles(root: string): string[] {
  const runtime = path.resolve(import.meta.dirname, "../..");
  return [
    ...new Set([
      ...dynamicFiles,
      ...Object.keys(createRequire(import.meta.url).cache),
    ]),
  ].filter((file) => {
    const relative = path.relative(root, file);
    return (
      relative !== ".." &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative) &&
      !relative.split(path.sep).includes("node_modules") &&
      !file.startsWith(runtime + path.sep)
    );
  });
}

export function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
