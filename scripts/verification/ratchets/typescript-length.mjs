import fs from "node:fs";
import path from "node:path";

import { countPhysicalLines, isTypeScriptPath } from "./lines.mjs";

const MAX_LINES = 300;
const ROOTS = ["src", "packages/viewer/src", "scripts"];

/** Compare candidate TypeScript contents with their optional predecessors. */
export function typeScriptLengthFindings(changes) {
  const findings = [];
  for (const change of changes) {
    const current = countPhysicalLines(change.current);
    const previous =
      change.previous === undefined
        ? undefined
        : countPhysicalLines(change.previous);
    const allowed =
      previous !== undefined && previous > MAX_LINES ? previous : MAX_LINES;
    if (current <= allowed) continue;
    const predecessor = change.predecessorPath
      ? `; predecessor ${change.predecessorPath} (${previous} lines)`
      : "; new file";
    findings.push(
      `${change.path}: ${current} lines; allowed ${allowed}${predecessor}`,
    );
  }
  return findings.sort();
}

/** Audit changed TypeScript files in the three contracted source roots. */
export function auditTypeScriptLength(repositoryRoot, git) {
  const candidates = [];
  for (const change of git.changedFiles(ROOTS)) {
    if (change.status.startsWith("D") || !isTypeScriptPath(change.path))
      continue;
    const absolute = path.join(repositoryRoot, change.path);
    if (!fs.lstatSync(absolute).isFile()) continue;
    const renamed = change.status.startsWith("R") ? change.source : undefined;
    const existing =
      renamed ?? (change.status.startsWith("A") ? undefined : change.path);
    candidates.push({
      path: change.path,
      current: fs.readFileSync(absolute),
      ...(existing
        ? {
            predecessorPath: existing,
            previous: git.readBase(existing),
          }
        : {}),
    });
  }
  return {
    findings: typeScriptLengthFindings(candidates),
    summary: `${candidates.length} changed TypeScript file(s)`,
  };
}
