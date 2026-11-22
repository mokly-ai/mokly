import fs from "node:fs";
import path from "node:path";

import { missingFile } from "./file-digests.js";

/** Follow written link targets without requiring the final target to exist. */
export function lexicalLinkTarget(
  file: string,
  visit?: (file: string) => void,
): string {
  const seen = new Set<string>();
  for (;;) {
    if (seen.has(file)) throw new Error("candidate link cycle");
    seen.add(file);
    let stat: fs.Stats | undefined;
    try {
      stat = fs.lstatSync(file, { throwIfNoEntry: false });
    } catch (error) {
      if (!missingFile(error)) throw error;
    }
    if (!stat?.isSymbolicLink()) return file;
    visit?.(file);
    file = path.resolve(path.dirname(file), fs.readlinkSync(file));
  }
}
