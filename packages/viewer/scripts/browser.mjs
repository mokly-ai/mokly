import fs from "node:fs/promises";
import path from "node:path";

import { build } from "esbuild";

/** Keep every delivered browser module's existing relative URL contract. */
export async function buildBrowserModules(sourceRoot, target, options = {}) {
  const entryPoints = Object.fromEntries(
    (await fs.readdir(sourceRoot))
      .filter((name) => name.endsWith(".ts") && name !== "nav_resize.ts")
      .map((name) => [
        name === "browse.ts" && options.viewer
          ? "browse_runtime"
          : name.slice(0, -3),
        path.join(sourceRoot, name),
      ]),
  );
  const exports = options.runtimeExports ?? new Map();
  await fs.rm(target, { force: true, recursive: true });
  await build({
    bundle: true,
    entryPoints,
    outdir: target,
    format: "esm",
    platform: "browser",
    target: "es2023",
    logLevel: "silent",
    plugins: [
      {
        name: "shared-shell-modules",
        setup(builder) {
          if (exports.size)
            builder.onLoad({ filter: /\.ts$/ }, async (args) => {
              if (path.dirname(args.path) !== sourceRoot) return;
              let contents = await fs.readFile(args.path, "utf8");
              contents = contents.replace(
                /import\s+(?!type\b)\{([^}]+)\}\s+from\s+["']@mokly\/viewer\/runtime["'];?/g,
                (_, names) =>
                  names
                    .split(",")
                    .map((name) => {
                      name = name.trim();
                      if (!name || name.startsWith("type ")) return "";
                      const owner = exports.get(name.split(/\s+as\s+/)[0]);
                      if (!owner)
                        throw new Error(
                          `Missing viewer runtime export: ${name}`,
                        );
                      return `import { ${name} } from "./${owner === "browse" ? "browse_runtime" : owner}.js";`;
                    })
                    .join("\n"),
              );
              return { contents, loader: "ts" };
            });
          builder.onResolve({ filter: /^\.\.?\// }, (args) => {
            if (path.dirname(args.importer) !== sourceRoot) return;
            if (
              args.path.startsWith("./") ||
              args.path.startsWith("../navigation/")
            )
              return { external: true, path: args.path };
          });
        },
      },
    ],
  });
  // Source-location comments are diagnostics, not a public-module path rename.
  for (const name of await fs.readdir(target)) {
    const filename = path.join(target, name);
    const code = await fs.readFile(filename, "utf8");
    await fs.writeFile(
      filename,
      code
        .replaceAll("packages/viewer/src/shell/", "src/server/shell/")
        .replaceAll("packages/viewer/src/", "src/"),
    );
  }
}
