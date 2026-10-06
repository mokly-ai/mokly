/** Typed non-fatal diagnostics produced while compiling catalogue documents. */

import { isSafeRepositoryPath } from "@mokly/viewer/data";

import {
  escapeTerminalControlCharacters,
  hasTerminalControlCharacters,
} from "../diagnostics/terminal_text.js";
import { MoklyError } from "../errors.js";

/** Stable codes available to build-warning producers. */
export type BuildDiagnosticCode =
  | "link-control-ancestor"
  | "link-control-descendant"
  | "removed-dependencies"
  | "removed-owned-dependencies"
  | "removed-shared-impact"
  | "duplicate-component-stylesheet"
  | "missing-configured-stylesheet-link"
  | "ignored-stylesheet-resource-owner";

/** A warning about an authored input rather than one generated page. */
export interface BuildDiagnosticSubject {
  readonly kind: "entry" | "component" | "folder" | "configuration";
  readonly path: string;
}

/** One diagnostic, excluded from generated catalogue bytes. */
export type BuildDiagnostic = {
  readonly code: BuildDiagnosticCode;
  readonly message: string;
} & (
  | { readonly route: string; readonly subject?: never }
  | { readonly subject: BuildDiagnosticSubject; readonly route?: never }
);

const CODES: readonly BuildDiagnosticCode[] = [
  "link-control-ancestor",
  "link-control-descendant",
  "removed-dependencies",
  "removed-owned-dependencies",
  "removed-shared-impact",
  "duplicate-component-stylesheet",
  "missing-configured-stylesheet-link",
  "ignored-stylesheet-resource-owner",
];
const KEBAB_CASE = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u;

/** Validate a diagnostic at the compilation boundary. */
function validateBuildDiagnostic(diagnostic: BuildDiagnostic): void {
  if (
    Object.keys(diagnostic).some(
      (key) => !["code", "route", "subject", "message"].includes(key),
    )
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic contains an unsupported field",
    );
  if (
    typeof diagnostic.code !== "string" ||
    !KEBAB_CASE.test(diagnostic.code) ||
    !CODES.includes(diagnostic.code)
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic code must be a supported kebab-case identifier",
    );
  if (diagnostic.subject !== undefined) {
    const subject = diagnostic.subject;
    if (
      diagnostic.route !== undefined ||
      !subject ||
      typeof subject !== "object" ||
      Object.keys(subject).some((key) => !["kind", "path"].includes(key)) ||
      !["entry", "component", "folder", "configuration"].includes(
        subject.kind,
      ) ||
      typeof subject.path !== "string" ||
      (!(subject.kind === "folder" && subject.path === "") &&
        !isSafeRepositoryPath(subject.path)) ||
      hasTerminalControlCharacters(subject.path)
    )
      throw new MoklyError(
        "build-invalid",
        "build diagnostic subject must have a supported kind and a safe relative POSIX path",
      );
  } else if (
    typeof diagnostic.route !== "string" ||
    !isSafeRepositoryPath(diagnostic.route) ||
    hasTerminalControlCharacters(diagnostic.route)
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic route must be a safe relative POSIX path",
    );
  if (
    typeof diagnostic.message !== "string" ||
    diagnostic.message.trim().length === 0 ||
    diagnostic.message.includes("\n") ||
    diagnostic.message.includes("\r") ||
    hasTerminalControlCharacters(diagnostic.message)
  )
    throw new MoklyError(
      "build-invalid",
      "build diagnostic message must be non-empty single-line text",
    );
}

/** Link controls report through exhaustive compilation, not ordinary preview requests. */
export function isLinkControlDiagnostic(diagnostic: BuildDiagnostic): boolean {
  return (
    diagnostic.code === "link-control-ancestor" ||
    diagnostic.code === "link-control-descendant"
  );
}

/** Format one diagnostic defensively for a terminal reporter. */
export function formatBuildDiagnostic(diagnostic: BuildDiagnostic): string {
  return `${escapeTerminalControlCharacters(diagnosticLocation(diagnostic))}: ${escapeTerminalControlCharacters(diagnostic.message)}`;
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
    compareText(diagnosticLocation(left), diagnosticLocation(right)) ||
    compareText(left.message, right.message) ||
    compareText(left.code, right.code) ||
    compareText(left.subject?.kind ?? "", right.subject?.kind ?? "")
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnosticLocation(diagnostic: BuildDiagnostic): string {
  return diagnostic.subject
    ? `${diagnostic.subject.kind} ${JSON.stringify(diagnostic.subject.path)}`
    : diagnostic.route;
}

/** Validate untrusted worker and child data using the compilation contract. */
export function isBuildDiagnostic(value: unknown): value is BuildDiagnostic {
  if (!value || typeof value !== "object") return false;
  try {
    validateBuildDiagnostic(value as BuildDiagnostic);
    return JSON.stringify(value).length <= 65_536;
  } catch {
    return false;
  }
}
