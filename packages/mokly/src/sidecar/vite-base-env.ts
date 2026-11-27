import fs from "node:fs";
import path from "node:path";

import type { ViteBaseEnv as BaseEnvInputs } from "../generated/sidecar/ViteBaseEnv.js";

import { inside, logical } from "./path-scope.js";

export interface EnvSelection {
  file: string | null;
  working: boolean;
}

/** Select a base dotenv file from the pinned tree or the working checkout. */
export class ViteBaseEnv {
  private readonly workingRoot: string;
  private readonly links: ReadonlyMap<string, string | null>;
  private readonly pinned: ReadonlySet<string>;
  private readonly indexed: ReadonlySet<string>;

  constructor(
    inputs: BaseEnvInputs,
    private readonly sourceRoot: string,
  ) {
    this.workingRoot = fs.realpathSync.native(inputs.workingRoot);
    this.links = new Map(Object.entries(inputs.links));
    this.pinned = new Set(inputs.pinned);
    this.indexed = new Set(inputs.indexed);
  }

  select(candidate: string): EnvSelection {
    if (!inside(this.sourceRoot, candidate))
      return { file: candidate, working: false };
    const target = this.target(logical(this.sourceRoot, candidate));
    if (target === null) return { file: null, working: false };
    if (inside(this.workingRoot, target)) {
      const name = logical(this.workingRoot, target);
      if (this.pinned.has(name))
        return { file: path.join(this.sourceRoot, name), working: false };
      if (this.indexed.has(name)) return { file: null, working: false };
    }
    return { file: target, working: true };
  }

  private target(name: string): string | null {
    let file = this.workingRoot;
    const pending: (string | { link: string })[] = name.split("/").reverse();
    const resolving = new Set<string>();
    for (let step = pending.pop(); step !== undefined; step = pending.pop()) {
      if (typeof step !== "string") {
        resolving.delete(step.link);
        continue;
      }
      file = path.join(file, step);
      if (!inside(this.workingRoot, file)) return workingTarget(file, pending);
      const name = logical(this.workingRoot, file);
      const link = this.links.get(name);
      if (link === undefined) continue;
      if (link === null || resolving.has(name)) return null;
      if (path.isAbsolute(link) && !inside(this.workingRoot, link))
        return workingTarget(link, pending);
      resolving.add(name);
      pending.push({ link: name });
      const start = path.isAbsolute(link)
        ? this.workingRoot
        : path.dirname(file);
      const relative = path.isAbsolute(link)
        ? link.startsWith(start + path.sep)
          ? link.slice(start.length + 1)
          : path.relative(start, link)
        : link;
      const parts = relative.split(path.sep === "\\" ? /[\\/]/ : "/");
      pending.push(...parts.reverse());
      file = start;
    }
    return file;
  }
}

/** Keep the working filesystem's native link traversal outside the checkout. */
function workingTarget(
  file: string,
  pending: readonly (string | { link: string })[],
): string {
  const suffix = pending.filter((step) => typeof step === "string").reverse();
  return [file, ...suffix].join(path.sep);
}
