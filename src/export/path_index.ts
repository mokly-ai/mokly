import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { exportError } from "./error.js";

/** Shared file-like route namespace for deployed files and hosting aliases. */
export class ExportPathIndex {
  readonly #names = new Map<string, string>();

  /** Reserve a safe path, rejecting case-folded equality and prefix collisions. */
  add(name: string): void {
    if (!isSafeRepositoryPath(name))
      throw exportError(`Unsafe export path: ${name}`);
    const folded = name.toLowerCase();
    for (const [existing, original] of this.#names) {
      if (existing === folded)
        throw exportError(`Export path collision: ${name} and ${original}`);
      if (
        existing.startsWith(`${folded}/`) ||
        folded.startsWith(`${existing}/`)
      )
        throw exportError(
          `Export file/directory collision: ${name} and ${original}`,
        );
    }
    this.#names.set(folded, name);
  }
}
