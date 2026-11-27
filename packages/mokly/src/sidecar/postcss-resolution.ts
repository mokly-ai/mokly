import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build, transformSync } from "esbuild";

import { detail } from "./errors.js";
import { importPath, resolveImport } from "./importer-resolution.js";
import { ModulePaths } from "./module-paths.js";
import type { ModuleSources } from "./module-paths.js";
import { moduleBytes } from "./postcss-evidence.js";
import { ownJsonRequire, postcssNativeImport } from "./postcss-path-hooks.js";
import { postcssRequireTarget } from "./postcss-require-target.js";
import { postcssScriptLoaders } from "./postcss-source.js";
import { resolutionOptions } from "./resolution.js";
import { bareSpecifier } from "./specifier.js";

let sources: ModulePaths;
const dynamicFiles = new Set<string>();
const commonJs = new Map<string, { exports: unknown }>();
const requiredFiles = new Map<
  string,
  { named: Set<string>; byPackage: boolean }
>();

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
              resolvedPath = await importPath(sources, name, resolved);
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
  specifier: string,
): Promise<Record<string, unknown>> {
  if (path.isAbsolute(file) && sources.repositoryOwned(file)) {
    const { importPostcssModule } = await import("./postcss-module.js");
    const { module, modules } = await importPostcssModule(file, sources, {
      kind: "import",
      specifier,
    });
    modules.forEach((file) => dynamicFiles.add(file));
    return module;
  }
  const url = path.isAbsolute(file) ? pathToFileURL(file).href : file;
  return postcssNativeImport(url, () => import(url));
}

function requireLocal(file: string): unknown {
  const cached = commonJs.get(file);
  if (cached) return cached.exports;
  if (path.extname(file) === ".json") {
    dynamicFiles.add(file);
    return ownJsonRequire(file, () => createRequire(file)(file));
  }
  const module = { exports: {} };
  commonJs.set(file, module);
  dynamicFiles.add(file);
  try {
    const code = transformSync(moduleBytes(file).toString(), {
      loader: postcssScriptLoaders[path.extname(file)] ?? "js",
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
    postcssRequireTarget(sources, name, file, options).file;
  const require = Object.assign(
    (name: string) => {
      if (
        name ===
        fileURLToPath(new URL("./postcss-resolution.js", import.meta.url))
      )
        return { context };
      const { file: target, named } = postcssRequireTarget(
        sources,
        name,
        file,
        undefined,
        true,
      );
      if (!path.isAbsolute(target) || !sources.repositoryOwned(target))
        return native(target);
      const loaded = requireLocal(target);
      let entry = requiredFiles.get(target);
      if (!entry)
        requiredFiles.set(
          target,
          (entry = { named: new Set(), byPackage: true }),
        );
      entry.named.add(named);
      entry.byPackage &&= bareSpecifier(name) && !path.isAbsolute(name);
      return loaded;
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
      if (options) {
        const url = path.isAbsolute(resolved)
          ? pathToFileURL(resolved).href
          : resolved;
        return postcssNativeImport(url, () => import(url, options));
      }
      return importPlugin(resolved, name);
    },
  };
}

export function loadedFiles(root: string): string[] {
  return [...dynamicFiles].filter((file) => repositoryModule(root, file));
}

/** The executed files omit resolution-only probes and ordinary file reads. */
export function nodeLoadedFiles(
  root: string,
  observed: Iterable<string>,
): Map<string, boolean> {
  const native = new Set(observed);
  const files = new Map(
    [...native]
      .filter((file) => repositoryModule(root, file))
      .map((file): [string, boolean] => [file, false]),
  );
  for (const [file, entry] of requiredFiles) {
    const byPackage = entry.byPackage && !native.has(file);
    for (const named of entry.named)
      if (repositoryModule(root, named))
        files.set(named, (files.get(named) ?? true) && byPackage);
  }
  return files;
}

const runtime = path.resolve(import.meta.dirname, "../..");

function repositoryModule(root: string, file: string): boolean {
  const relative = path.relative(root, file);
  return (
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative) &&
    !relative.split(path.sep).includes("node_modules") &&
    !file.startsWith(runtime + path.sep)
  );
}

export function plainObject(value: unknown): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    (Object.getPrototypeOf(value) === Object.prototype ||
      Object.getPrototypeOf(value) === null)
  );
}
