/** Allocate owned test directories even when a repository scratch parent is absent. */

import { mkdirSync, mkdtempSync } from "node:fs";
import path from "node:path";

/** @param {string} prefix The complete path prefix of the owned directory. */
export function scratchDirectory(prefix) {
  mkdirSync(path.dirname(prefix), { recursive: true });
  return mkdtempSync(prefix);
}
