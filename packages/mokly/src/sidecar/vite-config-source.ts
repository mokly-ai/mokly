import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { transform } from "esbuild";
import type { OnLoadResult } from "esbuild";

import { moduleContext } from "./postcss-context.js";

export async function viteConfigSource(
  file: string,
  record: (file: string, digest: string) => void,
): Promise<OnLoadResult> {
  const bytes = await fs.readFile(file);
  record(file, createHash("sha256").update(bytes).digest("hex"));
  const extension = path.extname(file);
  if (!/\.[cm]?[jt]sx?$/.test(extension))
    return { contents: bytes, loader: "default" };
  const output = await transform(bytes.toString("utf8"), {
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
