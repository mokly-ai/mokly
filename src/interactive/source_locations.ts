/** Repository ownership with directory and symlink projection cached per build. */

import fs from "node:fs";
import path from "node:path";

import {
  graphSourceLocation,
  isGraphRuntimePath,
} from "../build/source_inventory.js";
import type { FileLocation } from "../config/file_locations.js";
import { isPackageCode } from "../config/package_code.js";
import { isInside, toPosixPath } from "../config/paths.js";

interface SourceDirectory {
  physicalPath: string;
  repository: boolean;
}

interface SourceChild {
  entry: fs.Dirent;
  parent: SourceDirectory;
}

/** Match graph ownership without resolving every installed module's realpath. */
export class LiveSourceLocations {
  private readonly physicalRoot: string;
  private readonly directories = new Map<string, SourceDirectory | undefined>();
  private readonly entries = new Map<string, ReadonlyMap<string, fs.Dirent>>();
  private readonly files = new Map<string, FileLocation | undefined>();

  constructor(private readonly repoRoot: string) {
    this.physicalRoot = fs.realpathSync(repoRoot);
    this.directories.set(repoRoot, {
      physicalPath: this.physicalRoot,
      repository: this.repository(this.physicalRoot),
    });
  }

  /** Locate a regular confined repository file, excluding runtime and packages. */
  get(candidate: string): FileLocation | undefined {
    if (process.platform === "win32")
      return graphSourceLocation(candidate, this.repoRoot);
    if (!path.isAbsolute(candidate)) return;
    const absolute = path.resolve(candidate);
    const logical = isInside(this.repoRoot, absolute)
      ? absolute
      : isInside(this.physicalRoot, absolute)
        ? path.resolve(
            this.repoRoot,
            path.relative(this.physicalRoot, absolute),
          )
        : undefined;
    if (!logical || logical === this.repoRoot) return;
    if (!this.files.has(logical)) this.files.set(logical, this.locate(logical));
    return this.files.get(logical);
  }

  private locate(logicalPath: string): FileLocation | undefined {
    try {
      const child = this.child(logicalPath);
      if (!child) return graphSourceLocation(logicalPath, this.repoRoot);
      const { entry, parent } = child;
      if (
        !entry.isSymbolicLink() &&
        (!parent.repository || entry.name === "node_modules" || !entry.isFile())
      )
        return;
      const physicalPath = this.physicalPath(child);
      if (
        entry.isSymbolicLink() &&
        (!this.repository(physicalPath) || !fs.statSync(physicalPath).isFile())
      )
        return;
      return {
        logicalPath,
        physicalPath,
        relativePath: toPosixPath(path.relative(this.repoRoot, logicalPath)),
        physicalRelativePath: toPosixPath(
          path.relative(this.physicalRoot, physicalPath),
        ),
      };
    } catch {
      return graphSourceLocation(logicalPath, this.repoRoot);
    }
  }

  private directory(candidate: string): SourceDirectory | undefined {
    if (!isInside(this.repoRoot, candidate)) return;
    if (!this.directories.has(candidate)) {
      let directory: SourceDirectory | undefined;
      const child = this.child(candidate);
      if (child) {
        const physicalPath = this.physicalPath(child);
        if (
          child.entry.isSymbolicLink()
            ? fs.statSync(physicalPath).isDirectory()
            : child.entry.isDirectory()
        )
          directory = {
            physicalPath,
            repository: this.repository(physicalPath),
          };
      }
      this.directories.set(candidate, directory);
    }
    return this.directories.get(candidate);
  }

  private child(candidate: string): SourceChild | undefined {
    const parent = this.directory(path.dirname(candidate));
    if (!parent) return;
    let entries = this.entries.get(parent.physicalPath);
    if (!entries) {
      entries = new Map(
        fs
          .readdirSync(parent.physicalPath, { withFileTypes: true })
          .map((entry) => [entry.name, entry]),
      );
      this.entries.set(parent.physicalPath, entries);
    }
    const entry = entries.get(path.basename(candidate));
    if (!entry) return;
    return { entry, parent };
  }

  private physicalPath({ entry, parent }: SourceChild): string {
    const physical = path.join(parent.physicalPath, entry.name);
    return entry.isSymbolicLink() ? fs.realpathSync.native(physical) : physical;
  }

  private repository(physicalPath: string): boolean {
    return (
      isInside(this.physicalRoot, physicalPath) &&
      !isPackageCode(physicalPath, this.repoRoot, {
        file: physicalPath,
        root: this.physicalRoot,
      }) &&
      !isGraphRuntimePath(physicalPath)
    );
  }
}
