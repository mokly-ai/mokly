import fs from "node:fs";
import path from "node:path";

import { compareCodeUnits } from "../config/path_order.js";

/** Recursively list regular files under a root in stable path order. */
export function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  return entries
    .flatMap((entry) => {
      const candidate = path.join(root, entry.name);
      return entry.isDirectory()
        ? walkFiles(candidate)
        : entry.isFile()
          ? [candidate]
          : [];
    })
    .sort(compareCodeUnits);
}
