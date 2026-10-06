import path from "node:path";

import { isInside } from "../config/paths.js";

/** Exact authored inputs and the directories needed to reach them. */
export class RequiredWatchIndex {
  private readonly files: ReadonlySet<string>;
  private readonly ancestors: ReadonlySet<string>;

  constructor(repoRoot: string, sources: readonly string[]) {
    this.files = new Set(sources.map((source) => path.resolve(source)));
    const ancestors = new Set<string>();
    for (const file of this.files) {
      let current = file;
      while (isInside(repoRoot, current)) {
        ancestors.add(current);
        if (current === repoRoot) break;
        current = path.dirname(current);
      }
    }
    this.ancestors = ancestors;
  }

  /** Test an exact file, its ancestor, or a descendant in O(path depth). */
  contains(candidate: string, repoRoot: string): boolean {
    if (this.ancestors.has(candidate)) return true;
    let current = candidate;
    while (isInside(repoRoot, current)) {
      if (this.files.has(current)) return true;
      if (current === repoRoot) break;
      current = path.dirname(current);
    }
    return false;
  }
}
