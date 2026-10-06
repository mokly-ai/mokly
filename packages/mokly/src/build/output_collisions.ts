import path from "node:path";

import { toPosixPath } from "../config/paths.js";
import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import { walkFiles } from "./discovery.js";
import { isOwned } from "./ownership.js";

interface OutputPath {
  name: string;
  folded: string;
  generated: boolean;
}

/** Check the next portable file namespace, excluding proven generated orphans. */
export function validateOutputCollisions(
  routes: readonly string[],
  config: ResolvedConfig,
  inventory: readonly string[] = nonGeneratedOutputFiles(config),
): void {
  const next = new Set(routes);
  const files: OutputPath[] = routes.map((name) => ({
    name,
    folded: name.toLowerCase(),
    generated: true,
  }));
  for (const name of inventory) {
    if (next.has(name)) continue;
    files.push({ name, folded: name.toLowerCase(), generated: false });
  }
  files.sort((a, b) => {
    const left = a.folded.split("/"),
      right = b.folded.split("/");
    for (let i = 0; i < Math.min(left.length, right.length); i++) {
      if (left[i] !== right[i]) return left[i]! < right[i]! ? -1 : 1;
    }
    return left.length - right.length;
  });
  const ancestors: OutputPath[] = [];
  for (const current of files) {
    while (ancestors.length) {
      const previous = ancestors.at(-1)!;
      if (
        current.folded === previous.folded ||
        current.folded.startsWith(`${previous.folded}/`)
      )
        break;
      ancestors.pop();
    }
    const collision = ancestors.find(
      (previous) => previous.generated || current.generated,
    );
    if (collision)
      throw new MoklyError(
        "build-invalid",
        `generated output collision: ${collision.name} and ${current.name}`,
      );
    ancestors.push(current);
  }
}

/** Capture the non-generated namespace for one compilation generation. */
export function nonGeneratedOutputFiles(
  config: ResolvedConfig,
): readonly string[] {
  return walkFiles(config.mockupsDir)
    .filter((file) => !isOwned(file, config))
    .map((file) => toPosixPath(path.relative(config.mockupsDir, file)));
}
