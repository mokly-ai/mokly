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

export function resolutionExtensions(
  configured: readonly string[],
): readonly string[] {
  return configured.length
    ? configured
    : [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];
}

export function mappedFiles(
  base: string,
  configured: readonly string[],
): string[] {
  return fileVariants(base, resolutionExtensions(configured));
}

export function fileVariants(
  base: string,
  extensions: readonly string[],
): string[] {
  const extension =
    Object.keys(rewrittenExtensions).find((suffix) => base.endsWith(suffix)) ??
    "";
  return [
    base,
    ...extensions.map((extension) => base + extension),
    ...(rewrittenExtensions[extension] ?? []).map(
      (replacement) => base.slice(0, -extension.length) + replacement,
    ),
  ];
}

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
  if (base === selected) return "file";
  const extensions = resolutionExtensions(configuredExtensions);
  const files = mappedFiles(base, configuredExtensions);
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
