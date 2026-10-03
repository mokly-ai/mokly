import fs from "node:fs";
import path from "node:path";

import { compareCodeUnits } from "../config/path_order.js";

/** Recursively list regular files under a root in stable path order. */
export function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
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
