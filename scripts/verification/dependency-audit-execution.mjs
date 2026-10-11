import { Buffer } from "node:buffer";

import { evaluateDependencyAudit } from "./dependency-audit-evaluation.mjs";
import {
  auditCause,
  auditEvaluation,
  auditIssue,
} from "./dependency-audit-issues.mjs";

/** Inputs needed to prove equality or evaluate a comparison tree. */
export const AUDIT_INPUT_FILES = [
  "package.json",
  "package-lock.json",
  "scripts/verification/dependency-audit-exceptions.json",
];

function parseJson(contents, source, kind) {
  try {
    return { value: JSON.parse(contents), issues: [] };
  } catch (error) {
    return {
      value: undefined,
      issues: [
        auditIssue(
          kind,
          `Invalid JSON in ${source}. Fix the file or restore registry access and retry. ${auditCause(error)}`,
        ),
      ],
    };
  }
}

async function readJson(readFile, file, files) {
  let contents;
  try {
    contents = await readFile(file);
    if (!Buffer.isBuffer(contents))
      throw new TypeError("file reader must return Buffer bytes");
    files.set(file, contents);
  } catch (error) {
    return {
      value: undefined,
      issues: [
        auditIssue(
          "input",
          `Cannot read ${file}. Restore the file and retry. ${auditCause(error)}`,
        ),
      ],
    };
  }
  return parseJson(contents.toString("utf8"), file, "input");
}

/** Run one live audit and strictly evaluate its output with these exact bytes. */
export async function runAuditTree({ command, runCommand, readFile, now }) {
  const files = new Map();
  let outcome;
  try {
    outcome = await runCommand(command);
  } catch (error) {
    return {
      files,
      evaluation: auditEvaluation([
        auditIssue(
          "input",
          `Dependency audit failed: ${auditCause(error)}. Retry after fixing command, registry, or input errors.`,
        ),
      ]),
    };
  }
  const parsed = parseJson(
    outcome.stdout,
    "npm registry audit output",
    "report",
  );
  const [lockfile, exceptions] = await Promise.all([
    readJson(readFile, AUDIT_INPUT_FILES[1], files),
    readJson(readFile, AUDIT_INPUT_FILES[2], files),
  ]);
  const evaluation = evaluateDependencyAudit(
    parsed.value,
    lockfile.value,
    exceptions.value,
    now,
  );
  evaluation.issues.push(
    ...parsed.issues,
    ...lockfile.issues,
    ...exceptions.issues,
  );
  if (outcome.signal || (outcome.exitCode !== 0 && outcome.exitCode !== 1)) {
    evaluation.issues.push(
      auditIssue(
        outcome.signal ? "input" : "report",
        `Unexpected npm audit exit status ${outcome.exitCode}; signal: ${outcome.signal ?? "none"}. Check npm and registry access, then retry. ${outcome.stderr}`,
      ),
    );
  } else if (!evaluation.issues.some((issue) => issue.kind === "report")) {
    const hasFindings = Object.values(parsed.value.vulnerabilities).some(
      (entry) => entry.severity !== "info",
    );
    if (outcome.exitCode !== (hasFindings ? 1 : 0))
      evaluation.issues.push(
        auditIssue(
          "report",
          `Unexpected npm audit exit status ${outcome.exitCode} for this report. Check npm and registry output, then retry.`,
        ),
      );
  }
  evaluation.ok = evaluation.issues.length === 0;
  return { files, evaluation };
}
