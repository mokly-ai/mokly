import { randomBytes } from "node:crypto";
import { createRequire, isBuiltin, Module } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";
import type { OnResolveArgs } from "esbuild";

import { detail } from "./errors.js";
import { bareSpecifier } from "./specifier.js";
import { context } from "./vite-config-context.js";
import { viteConfigError, viteConfigMap } from "./vite-config-errors.js";
import { viteConfigSource } from "./vite-config-source.js";
import { externalType } from "./vite-external.js";
import type { loadVite } from "./vite-peers.js";
import type { ViteLookup } from "./vite-resolution.js";

class ConfigModule extends Module {
  declare _compile: (code: string, file: string) => void;
}

export async function bundleViteConfig(
  vite: Awaited<ReturnType<typeof loadVite>>["api"],
  directory: string,
  file: string,
  lookup: ViteLookup,
) {
  const config = await vite.resolveConfig(
    {
      configFile: false,
      envDir: false,
      css: { postcss: {} },
      root: directory,
      logLevel: "silent",
      cacheDir: directory,
      environments: {
        inline: {
          consumer: "server",
          resolve: {
            external: true,
            mainFields: [],
            conditions: ["node", "module-sync"],
          },
        },
      },
    },
    "serve",
  );
  const environment = vite.createRunnableDevEnvironment("inline", config, {
    hot: false,
    runnerOptions: { hmr: false },
  });
  lookup.bind(vite, environment);
  await environment.init();
  const format = (await externalType(file)) === "module" ? "esm" : "cjs";
  const runtime = new URL("./vite-config-context.js", import.meta.url).href;
  let compiled;
  try {
    compiled = await build({
      absWorkingDir: directory,
      // Vite's diagnostic formatter maps absolute locations to logical names.
      absPaths: ["log"],
      entryPoints: [file],
      outfile: "mokly-vite-config.js",
      bundle: true,
      write: false,
      splitting: false,
      platform: "node",
      format,
      mainFields: ["main"],
      conditions: ["node"],
      metafile: true,
      sourcemap: "external",
      logLevel: "silent",
      keepNames: true,
      plugins: [
        {
          name: "mokly-vite-config",
          setup(builder) {
            builder.onResolve({ filter: /^mokly:postcss-context$/ }, () => ({
              path: runtime,
              external: true,
            }));
            const resolve = async (args: OnResolveArgs) => {
              if (args.kind === "entry-point" || args.pluginData === "resolved")
                return;
              if (isBuiltin(args.path))
                return { path: args.path, external: true };
              const native =
                format === "cjs" &&
                args.kind !== "dynamic-import" &&
                bareSpecifier(args.path)
                  ? fileURLToPath(
                      lookup.sync(
                        args.path,
                        args.importer,
                        (source, parent) =>
                          pathToFileURL(createRequire(parent).resolve(source))
                            .href,
                      ),
                    )
                  : undefined;
              const found = native
                ? null
                : await lookup.nodeEntry(args.path, args.importer);
              const resolved =
                native ??
                found?.resolved.id ??
                (
                  await builder.resolve(args.path, {
                    importer: args.importer,
                    resolveDir: args.resolveDir,
                    kind: args.kind,
                    pluginData: "resolved",
                  })
                ).path;
              if (!resolved) return;
              const target = await lookup.paths.resolve(resolved);
              return lookup.paths.repositoryOwned(target)
                ? { path: target }
                : { path: pathToFileURL(target).href, external: true };
            };
            builder.onResolve({ filter: /.*/ }, (args) =>
              resolve(args).catch((error: unknown) => ({
                errors: [{ text: detail(error) }],
              })),
            );
            builder.onLoad({ filter: /.*/ }, (args) =>
              viteConfigSource(args.path),
            );
          },
        },
      ],
    });
  } catch (error) {
    throw viteConfigError(error, file);
  } finally {
    await environment.close();
  }
  const output = compiled.outputFiles!.find((output) =>
    output.path.endsWith(".js"),
  )!;
  const map = viteConfigMap(
    compiled.outputFiles!.find((output) => output.path.endsWith(".map"))!.text,
  );
  const prefix =
    format === "esm"
      ? `import { context as __moklyViteContext } from ${JSON.stringify(runtime)}; const require = __moklyViteContext(${JSON.stringify(file)}).require;\n`
      : "";
  const code =
    prefix +
    output.text.replace(/^#![^\n]*/, "") +
    `\n//# sourceURL=${pathToFileURL(file).href}\n`;
  const locate = (error: unknown) =>
    viteConfigError(error, file, map, prefix ? 1 : 0);
  let exported: unknown;
  try {
    if (format === "esm") {
      const module = await import(
        `data:text/javascript;base64,${Buffer.from(code).toString("base64")}#${randomBytes(16).toString("hex")}`
      );
      exported = module.default;
    } else {
      const module = new ConfigModule(file);
      module.filename = file;
      module.require = context(file).require;
      module._compile(code, file);
      const value: unknown = module.exports;
      exported =
        value &&
        typeof value === "object" &&
        "__esModule" in value &&
        value.__esModule &&
        "default" in value
          ? value.default
          : value;
    }
  } catch (error) {
    throw locate(error);
  }
  return {
    exported,
    locate,
    dependencies: Object.keys(compiled.metafile!.inputs).map((input) =>
      path.resolve(directory, input),
    ),
  };
}
