/** Typed non-fatal diagnostics produced while compiling catalogue documents. */

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import { MoklyError } from "../errors.js";

/** Stable codes available to build-warning producers. */
export type BuildDiagnosticCode =
  "link-control-ancestor" | "link-control-descendant";

/** One route-scoped warning that never enters generated catalogue bytes. */
export interface BuildDiagnostic {
  readonly code: BuildDiagnosticCode;
  readonly route: string;
  readonly message: string;
}

const CODES: readonly BuildDiagnosticCode[] = [
  "link-control-ancestor",
  "link-control-descendant",
];
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

/** Validate a diagnostic at the compilation boundary. */
function validateBuildDiagnostic(diagnostic: BuildDiagnostic): void {
  if (
    typeof diagnostic.code !== "string" ||
    !KEBAB_CASE.test(diagnostic.code) ||
    !CODES.includes(diagnostic.code)
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic code must be a supported kebab-case identifier",
    );
  if (
    typeof diagnostic.route !== "string" ||
    !isSafeRepositoryPath(diagnostic.route)
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic route must be a safe relative POSIX path",
    );
  if (
    typeof diagnostic.message !== "string" ||
    diagnostic.message.trim().length === 0 ||
    diagnostic.message.includes("\n") ||
    diagnostic.message.includes("\r")
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic message must be non-empty single-line text",
    );
}

/** Validate, sort, and de-duplicate diagnostics independently of render order. */
export function normalizeBuildDiagnostics(
  diagnostics: Iterable<BuildDiagnostic>,
): readonly BuildDiagnostic[] {
  const sorted = [...diagnostics];
  for (const diagnostic of sorted) validateBuildDiagnostic(diagnostic);
  sorted.sort(compareDiagnostics);
  return sorted.filter(
    (diagnostic, index) =>
      index === 0 || compareDiagnostics(diagnostic, sorted[index - 1]!) !== 0,
  );
}

/** Turn non-fatal warnings into the command's strict-mode build failure. */
export function enforceStrictBuildWarnings(
  diagnostics: readonly BuildDiagnostic[],
  strict: boolean,
): void {
  if (!strict || diagnostics.length === 0) return;
  const count = diagnostics.length;
  throw new MoklyError(
    "build-invalid",
    `${count} build ${count === 1 ? "warning" : "warnings"} with --strict`,
  );
}

function compareDiagnostics(
  left: BuildDiagnostic,
  right: BuildDiagnostic,
): number {
  return (
    compareText(left.route, right.route) ||
    compareText(left.message, right.message) ||
    compareText(left.code, right.code)
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
