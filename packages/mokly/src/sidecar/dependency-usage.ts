import fs from "node:fs";
import path from "node:path";

import type { ModuleResolution } from "../generated/sidecar/ModuleResolution.js";

import { inside, logical } from "./path-scope.js";

type Candidate = { directory: string; package: string };

/** Observe actual repository import lookups without changing the bundler's choice. */
export class DependencyUsage {
  readonly unmapped = new Set<string>();
  private candidates = new Map<string, Promise<Candidate[]>>();

  constructor(
    private readonly sourceRoot: string,
    private readonly selected: string[],
    private readonly settings: ModuleResolution,
    private readonly configuration: string,
  ) {}

  file(file: string): void {
    if (
      !inside(this.sourceRoot, file) ||
      this.selected.some((root) => inside(root, file))
    )
      return;
    const relative = logical(this.sourceRoot, file);
    const parts = relative.split("/");
    const index = parts.indexOf("node_modules");
    if (index >= 0) this.unmapped.add(parts.slice(0, index + 1).join("/"));
  }

  async resolved(
    specifier: string,
    directory: string,
    file: string,
  ): Promise<void> {
    if (
      !path.isAbsolute(file) ||
      !inside(this.sourceRoot, directory) ||
      logical(this.sourceRoot, directory).split("/").includes("node_modules")
    )
      return;
    const alias = Object.keys(this.settings.aliases)
      .filter((name) => specifier === name || specifier.startsWith(name + "/"))
      .sort((left, right) => right.length - left.length)[0];
    if (alias) {
      specifier = this.settings.aliases[alias]! + specifier.slice(alias.length);
      directory = this.configuration;
    }
    if (/^(\.|\/|#|[a-z]+:)/i.test(specifier)) return;
    const parts = specifier.split("/");
    const name = parts.slice(0, specifier.startsWith("@") ? 2 : 1).join("/");
    const key = JSON.stringify([directory, name]);
    let candidates = this.candidates.get(key);
    if (!candidates) {
      candidates = this.lookup(directory, name);
      this.candidates.set(key, candidates);
    }
    const used = (await candidates).find((candidate) =>
      inside(candidate.package, file),
    );
    if (!used) return;
    const realDirectory = await realpath(used.directory);
    const index = this.selected.indexOf(realDirectory ?? used.directory);
    if (index < 0) {
      this.unmapped.add(logical(this.sourceRoot, used.directory));
      return;
    }
    for (const earlier of this.selected.slice(0, index)) {
      if (await realpath(path.join(earlier, name))) {
        this.unmapped.add(logical(this.sourceRoot, used.directory));
        break;
      }
    }
  }

  resolvedSync(specifier: string, directory: string, file: string): void {
    if (
      !path.isAbsolute(file) ||
      !inside(this.sourceRoot, directory) ||
      logical(this.sourceRoot, directory).split("/").includes("node_modules")
    )
      return;
    const alias = Object.keys(this.settings.aliases)
      .filter((name) => specifier === name || specifier.startsWith(name + "/"))
      .sort((left, right) => right.length - left.length)[0];
    if (alias) {
      specifier = this.settings.aliases[alias]! + specifier.slice(alias.length);
      directory = this.configuration;
    }
    if (/^(\.|\/|#|[a-z]+:)/i.test(specifier)) return;
    const name = specifier
      .split("/")
      .slice(0, specifier.startsWith("@") ? 2 : 1)
      .join("/");
    while (inside(this.sourceRoot, directory)) {
      const root = path.join(directory, "node_modules");
      const candidate =
        path.basename(directory) === "node_modules"
          ? undefined
          : realpathSync(path.join(root, name));
      if (candidate && inside(candidate, file)) {
        const index = this.selected.indexOf(realpathSync(root) ?? root);
        if (
          index < 0 ||
          this.selected
            .slice(0, index)
            .some((earlier) => realpathSync(path.join(earlier, name)))
        )
          this.unmapped.add(logical(this.sourceRoot, root));
        break;
      }
      if (directory === this.sourceRoot) break;
      directory = path.dirname(directory);
    }
  }

  private async lookup(directory: string, name: string): Promise<Candidate[]> {
    const candidates: Candidate[] = [];
    while (inside(this.sourceRoot, directory)) {
      if (path.basename(directory) !== "node_modules") {
        const root = path.join(directory, "node_modules");
        const resolved = await realpath(path.join(root, name));
        if (resolved) candidates.push({ directory: root, package: resolved });
      }
      if (directory === this.sourceRoot) break;
      directory = path.dirname(directory);
    }
    return candidates;
  }
}

async function realpath(file: string): Promise<string | undefined> {
  try {
    return await fs.promises.realpath(file);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return undefined;
    throw error;
  }
}

function realpathSync(file: string): string | undefined {
  try {
    return fs.realpathSync(file);
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      ["ENOENT", "ENOTDIR"].includes(String(error.code))
    )
      return undefined;
    throw error;
  }
}
