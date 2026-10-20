import path from "node:path";
import { pathToFileURL } from "node:url";

import { transform } from "esbuild";
import type { Loader, OnLoadResult } from "esbuild";

import { moduleContext } from "./postcss-context.js";
import { moduleBytesAsync, preloadedCode } from "./postcss-evidence.js";

function loader(value: string | undefined): Loader | undefined {
  switch (value) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "json":
    case "text":
    case "base64":
    case "binary":
    case "dataurl":
    case "empty":
    case "file":
    case "copy":
    case "css":
    case "local-css":
      return value;
    default:
      return undefined;
  }
}

/** Every supported loader receives the raw buffer whose digest was recorded. */
export async function postcssSource(
  file: string,
  configured: Record<string, string>,
): Promise<OnLoadResult | undefined> {
  const extension = Object.keys(configured)
    .sort((left, right) => right.length - left.length)
    .find((suffix) => file.endsWith(suffix));
  const defaults: Record<string, Loader> = {
    ".js": "js",
    ".mjs": "js",
    ".cjs": "js",
    ".jsx": "jsx",
    ".ts": "ts",
    ".mts": "ts",
    ".cts": "ts",
    ".tsx": "tsx",
    ".json": "json",
    ".css": "css",
  };
  const selected =
    defaults[path.extname(file)] ??
    (extension ? loader(configured[extension]) : undefined);
  if (!selected) return undefined;
  const script = ["js", "jsx", "ts", "tsx"].includes(selected);
  const defaultAsset = !script && defaults[path.extname(file)] !== undefined;
  if (preloadedCode && defaultAsset) return undefined;
  const bytes = await moduleBytesAsync(file, defaultAsset);
  if (!script) return { contents: bytes, loader: selected };
  const output = await transform(bytes.toString(), {
    loader: selected,
    define: {
      "import.meta.url": JSON.stringify(pathToFileURL(file).href),
      "import.meta.dirname": JSON.stringify(path.dirname(file)),
      "import.meta.filename": JSON.stringify(file),
      __dirname: JSON.stringify(path.dirname(file)),
      __filename: JSON.stringify(file),
    },
  });
  return { contents: moduleContext(output.code, file), loader: "js" };
}
