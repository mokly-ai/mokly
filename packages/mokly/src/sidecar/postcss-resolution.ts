import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { build } from "esbuild";

/** Record-form plugins use the same import conditions as config ESM imports. */
export async function resolvePlugin(
  name: string,
  file: string,
): Promise<string> {
  let resolvedPath: string | undefined;
  await build({
    stdin: {
      contents: `import ${JSON.stringify(name)};`,
      resolveDir: path.dirname(file),
    },
    bundle: true,
    write: false,
    platform: "node",
    conditions: ["node", "node-addons"],
    mainFields: ["main"],
    logLevel: "silent",
    plugins: [
      {
        name: "postcss-record",
        setup(build) {
          build.onResolve({ filter: /.*/ }, async (args) => {
            if (args.pluginData === "resolved") return;
            const resolved = await build.resolve(args.path, {
              resolveDir: args.resolveDir,
              kind: "import-statement",
              pluginData: "resolved",
            });
            if (resolved.errors.length) return { errors: resolved.errors };
            resolvedPath = resolved.path;
            return { path: resolved.path, external: true };
          });
        },
      },
    ],
  });
  if (!resolvedPath)
    throw new Error(`could not resolve PostCSS plugin ${name}`);
  return resolvedPath;
}

const dynamicFiles = new Set<string>();

/** Module-bound native loading for references esbuild cannot enumerate. */
export function context(file: string) {
  const require = createRequire(file);
  return {
    require,
    async import(value: unknown, options?: ImportCallOptions) {
      const name = String(value);
      const resolved = /^(node|file|data):/.test(name)
        ? name
        : await resolvePlugin(name, file);
      const url = path.isAbsolute(resolved)
        ? pathToFileURL(resolved).href
        : resolved;
      if (url.startsWith("file:")) dynamicFiles.add(fileURLToPath(url));
      return import(url, options);
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
