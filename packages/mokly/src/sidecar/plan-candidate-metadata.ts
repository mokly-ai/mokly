import path from "node:path";

import { jsonObject, parseJson } from "./config-json.js";

/** Interpret already-read manifests without keeping another metadata snapshot. */
export function candidateMetadata(
  file: string,
  bytes: Buffer,
  fields: readonly string[],
  candidate: (directory: string, name: string) => void,
): boolean {
  if (path.basename(file) !== "package.json") return true;
  try {
    const json = parseJson(bytes.toString("utf8"));
    if (!jsonObject(json) || !ordinaryExports(json.exports)) return false;
    for (const field of new Set(["main", "module", ...fields])) {
      const target = json[field];
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
  if (jsonObject(value))
    return Object.entries(value).every(
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
