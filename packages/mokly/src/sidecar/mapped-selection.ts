import fs from "node:fs";
import path from "node:path";

import { missingFile } from "./file-digests.js";
import { inside } from "./path-scope.js";

const rewrittenExtensions: Readonly<Record<string, readonly string[]>> = {
  ".js": [".ts", ".tsx"],
  ".jsx": [".ts", ".tsx"],
  ".mjs": [".mts"],
  ".cjs": [".cts"],
};

function canonical(file: string): string | undefined {
  try {
    return fs.realpathSync.native(file);
  } catch (error) {
    if (!missingFile(error)) throw error;
    return undefined;
  }
}

/** Associate a native selected file with a configured file or folder candidate. */
export function mappedSelection(
  base: string,
  selected: string,
  configuredExtensions: readonly string[],
): "file" | "directory" | "contained" | undefined {
  const extensions = configuredExtensions.length
    ? configuredExtensions
    : [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];
  const extension = path.extname(base);
  const files = [
    base,
    ...extensions.map((extension) => base + extension),
    ...(rewrittenExtensions[extension] ?? []).map(
      (replacement) => base.slice(0, -extension.length) + replacement,
    ),
  ];
  if (files.includes(selected)) return "file";
  const real = canonical(base);
  if (real === selected) return "file";
  if (real && inside(real, selected)) {
    const directIndex =
      path.dirname(selected) === real &&
      extensions.some(
        (extension) => path.basename(selected) === `index${extension}`,
      );
    return directIndex ? "directory" : "contained";
  }
  return files.slice(1).some((file) => canonical(file) === selected)
    ? "file"
    : undefined;
}
