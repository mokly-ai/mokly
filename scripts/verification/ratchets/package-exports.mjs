import path from "node:path";

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
];

/** Recursively collect JavaScript targets outside `types` conditions. */
export function javascriptExportTargets(value, underTypes = false) {
  if (typeof value === "string")
    return underTypes || !/\.[cm]?js$/u.test(value) ? [] : [value];
  if (Array.isArray(value))
    return value.flatMap((nested) =>
      javascriptExportTargets(nested, underTypes),
    );
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([condition, nested]) =>
    javascriptExportTargets(nested, underTypes || condition === "types"),
  );
}

/** Map one built JavaScript target to its first existing source module. */
export function sourcePathForExport(packageRoot, target, fileExists) {
  const relative = target
    .replace(/^\.\/dist\//u, "")
    .replace(/\.[cm]?js$/u, "");
  for (const extension of SOURCE_EXTENSIONS) {
    const candidate = normalize(
      path.posix.join(packageRoot, "src", `${relative}${extension}`),
    );
    if (fileExists(candidate)) return candidate;
  }
  return undefined;
}

function normalize(file) {
  return file.replaceAll("\\", "/").replace(/^\.\//u, "");
}
