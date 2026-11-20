import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { transform } from "esbuild";
import type { OnLoadResult } from "esbuild";

import { moduleContext } from "./postcss-context.js";

export async function viteConfigSource(
  file: string,
): Promise<OnLoadResult | undefined> {
  const extension = path.extname(file);
  if (!/\.[cm]?[jt]sx?$/.test(extension)) return;
  const source = await fs.readFile(file, "utf8");
  const output = await transform(source, {
    sourcefile: file,
    sourcemap: "inline",
    loader: extension.endsWith("x")
      ? extension === ".tsx"
        ? "tsx"
        : "jsx"
      : extension.includes("t")
        ? "ts"
        : "js",
    define: {
      __dirname: JSON.stringify(path.dirname(file)),
      __filename: JSON.stringify(file),
      "import.meta.dirname": JSON.stringify(path.dirname(file)),
      "import.meta.filename": JSON.stringify(file),
      "import.meta.url": JSON.stringify(pathToFileURL(file).href),
    },
  });
  return { contents: moduleContext(output.code, file), loader: "js" };
}
