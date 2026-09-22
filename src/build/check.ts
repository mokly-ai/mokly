import fs from "node:fs";
import path from "node:path";

import type { ResolvedConfig } from "../config/types.js";
import { MoklyError } from "../errors.js";

import type { Compilation } from "./compile.js";
import {
  pendingGeneratedOrphanRoutes,
  unclaimedGeneratedRoutes,
} from "./ownership.js";

/** Compare expected bytes with committed output without writing anything. */
export function checkCompilation(
  compilation: Compilation,
  config: ResolvedConfig,
): void {
  config = { ...config, sourceFiles: compilation.manifest.sourceFiles };
  const missing: string[] = [];
  const stale: string[] = [];
  for (const [route, expected] of compilation.outputs) {
    const target = path.join(config.mockupsDir, route);
    if (!fs.existsSync(target)) {
      missing.push(route);
    } else if (fs.readFileSync(target, "utf8") !== expected) {
      stale.push(route);
    }
  }
  const orphan = pendingGeneratedOrphanRoutes(
    config,
    compilation.outputs.keys(),
  );
  const unclaimed = unclaimedGeneratedRoutes(config);
  if (
    missing.length === 0 &&
    stale.length === 0 &&
    orphan.length === 0 &&
    unclaimed.length === 0
  )
    return;
  const groups = [
    formatGroup("missing generated files", missing),
    formatGroup("stale generated files", stale),
    formatGroup("orphan generated files", orphan),
    formatGroup("unclaimed generated files", unclaimed),
  ].filter(Boolean);
  const unclaimedGuidance =
    unclaimed.length === 0
      ? ""
      : "\nUnclaimed generated files are not changed by build; delete them or restore the source under a configured entry glob.";
  throw new MoklyError(
    "build-invalid",
    `committed output does not match source; run mokly build:\n${groups.join("\n")}${unclaimedGuidance}`,
  );
}

function formatGroup(title: string, routes: readonly string[]): string {
  if (routes.length === 0) return "";
  return `${title}:\n${[...routes]
    .sort()
    .map((route) => `  - ${route}`)
    .join("\n")}`;
}
