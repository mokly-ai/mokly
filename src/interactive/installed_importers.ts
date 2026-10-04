/** Recorded installed importer lookup with validation only for possible matches. */

import path from "node:path";

import { installedSourceImporter } from "../build/interactive_source_paths.js";
import type {
  InteractiveSourceImporter,
  InteractiveSourceResolution,
} from "../build/interactive_source_resolution.js";
import { isInside, toPosixPath } from "../config/paths.js";

/** Cache recorded installed identities and negative lookups for one Live build. */
export class RecordedInstalledImporters {
  private readonly paths = new Set<string>();
  private readonly identities = new Map<
    string,
    InteractiveSourceImporter | undefined
  >();

  constructor(
    private readonly repoRoot: string,
    resolutions: readonly InteractiveSourceResolution[],
  ) {
    for (const { importer } of resolutions)
      if (importer.type === "installed") this.paths.add(importer.path);
  }

  /** Return a fully validated recorded identity without probing unrelated logical paths. */
  get(candidate: string): InteractiveSourceImporter | undefined {
    if (this.paths.size === 0) return;
    if (!this.identities.has(candidate))
      this.identities.set(candidate, this.resolve(candidate));
    return this.identities.get(candidate);
  }

  private resolve(candidate: string): InteractiveSourceImporter | undefined {
    if (!path.isAbsolute(candidate)) return;
    if (isInside(this.repoRoot, candidate)) {
      const key = toPosixPath(path.relative(this.repoRoot, candidate));
      if (!this.paths.has(key)) return;
    }
    const importer = installedSourceImporter(candidate, this.repoRoot);
    return importer?.type === "installed" && this.paths.has(importer.path)
      ? importer
      : undefined;
  }
}
