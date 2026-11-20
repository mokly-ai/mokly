import path from "node:path";

import { PackageJson, parsePackageJson } from "./package-json.js";

/** Interpret already-read manifests without keeping another metadata snapshot. */
export function candidateMetadata(
  file: string,
  bytes: Buffer,
  fields: readonly string[],
  candidate: (directory: string, name: string) => void,
): boolean {
  if (path.basename(file) !== "package.json") return true;
  try {
    const manifest = parsePackageJson(bytes.toString("utf8"));
    if (!manifest.values("exports").every((value) => ordinaryExports(value)))
      return false;
    for (const field of new Set(["main", "module", ...fields]))
      for (const target of manifest.values(field)) {
        if (typeof target !== "string" || !target) continue;
        if (/[%*?#\\]/.test(target)) return false;
        candidate(path.dirname(file), target);
      }
    return true;
  } catch {
    return false;
  }
}

function ordinaryExports(value: unknown, depth = 0): boolean {
  if (depth > 32) return false;
  if (typeof value === "string") return !/[%?#\\]/.test(value);
  if (Array.isArray(value))
    return value.every((item) => ordinaryExports(item, depth + 1));
  if (value instanceof PackageJson)
    return value.entries.every(
      ([key, item]) =>
        !(
          key.startsWith(".") &&
          key.endsWith("/") &&
          (!key.startsWith("./") || key.includes("*"))
        ) &&
        !/[%?#\\]/.test(key) &&
        ordinaryExports(item, depth + 1),
    );
  return value === undefined || value === null;
}
