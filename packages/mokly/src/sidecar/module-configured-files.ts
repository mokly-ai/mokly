import fs from "node:fs";
import path from "node:path";

/** Configured paths keep their exact file identity across resolution. */
export class ConfiguredModuleFiles {
  private readonly files = new Set<string>();
  private canonical: Set<string> | undefined;

  constructor(
    private readonly root: string,
    files: readonly string[],
  ) {
    for (const file of files) this.files.add(path.resolve(root, file));
  }

  add(file: string): void {
    this.files.add(path.resolve(this.root, file));
    this.canonical = undefined;
  }

  has(file: string): boolean {
    if (this.files.has(file)) return true;
    this.canonical ??= new Set(
      [...this.files].flatMap((candidate) => {
        try {
          return [fs.realpathSync(candidate)];
        } catch {
          return [];
        }
      }),
    );
    return this.canonical.has(file);
  }
}
