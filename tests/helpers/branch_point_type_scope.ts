import path from "node:path";

import ts from "typescript";

import { guardedBranchPointModule } from "./branch_point_guard.js";
import { repositoryRoot } from "./fixture.js";

const BOUNDARIES = new Set([
  "packages/viewer/src/catalogue/path_values.ts",
  "packages/viewer/src/catalogue/accepted_paths.ts",
  "packages/viewer/src/shell/accepted_inputs.ts",
]);

/** Select typed consumers by repository-relative POSIX path on every platform. */
export function guardedTypedBranchPointModule(file: string): boolean {
  const normalized = file.split("\\").join("/");
  if (BOUNDARIES.has(normalized)) return false;
  if (normalized === "packages/viewer/src/review/result_branch_points.ts")
    return true;
  return guardedBranchPointModule(normalized);
}

/** Use the same module resolution and strict compiler settings as typecheck. */
export function branchPointTypeProgram(): ts.Program {
  const config = ts.readConfigFile(
    path.join(repositoryRoot, "tsconfig.json"),
    ts.sys.readFile,
  );
  if (config.error)
    throw new Error(
      ts.flattenDiagnosticMessageText(config.error.messageText, "\n"),
    );
  const parsed = ts.parseJsonConfigFileContent(
    config.config,
    ts.sys,
    repositoryRoot,
  );
  if (parsed.errors.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCurrentDirectory: () => repositoryRoot,
        getCanonicalFileName: (file) => file,
        getNewLine: () => "\n",
      }),
    );
  return ts.createProgram(parsed.fileNames, {
    ...parsed.options,
    noEmit: true,
  });
}
