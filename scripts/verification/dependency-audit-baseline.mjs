import { Buffer } from "node:buffer";

import { auditCommandInDirectory } from "./dependency-audit-command.mjs";
import {
  AUDIT_INPUT_FILES,
  runAuditTree,
} from "./dependency-audit-execution.mjs";
import { auditCause, auditIssue } from "./dependency-audit-issues.mjs";

function inherited(issue, baselineIssues) {
  if (issue.kind === "finding")
    return baselineIssues.some(
      (base) =>
        base.kind === "finding" &&
        base.package === issue.package &&
        base.advisoryUrl === issue.advisoryUrl &&
        issue.installLocations.every((location) =>
          base.installLocations.includes(location),
        ),
    );
  return (
    issue.kind === "exception" &&
    baselineIssues.some(
      (base) => base.kind === "exception" && base.message === issue.message,
    )
  );
}

function annotate(issues, value) {
  return issues.map((issue) => ({ ...issue, inherited: value }));
}

/** Compare raw input bytes before auditing the comparison tree through IO seams. */
export async function compareDependencyAudit({
  head,
  command,
  runCommand,
  readFile,
  baseline,
  now,
}) {
  const headIssues = head.evaluation.issues;
  const failed = (issues, comparisonCommit) => ({
    ...(comparisonCommit ? { comparisonCommit } : {}),
    issues: [...annotate(headIssues, false), ...annotate(issues, false)],
  });
  let comparisonCommit;
  try {
    comparisonCommit = await baseline.resolveComparisonCommit();
  } catch (error) {
    return failed([
      auditIssue(
        "input",
        `Dependency audit could not resolve the comparison commit. Run git fetch origin main and retry; refresh any moved merge. ${auditCause(error)}`,
      ),
    ]);
  }
  const baseFiles = new Map();
  const workingFiles = new Map(head.files);
  try {
    await Promise.all(
      AUDIT_INPUT_FILES.map(async (file) => {
        let bytes;
        try {
          bytes = await baseline.readRevision(comparisonCommit, file);
          if (!Buffer.isBuffer(bytes))
            throw new TypeError("revision reader must return Buffer bytes");
        } catch (cause) {
          throw new Error(
            `Cannot read comparison file ${file} at ${comparisonCommit}.`,
            { cause },
          );
        }
        baseFiles.set(file, bytes);
        if (!workingFiles.has(file)) {
          const current = await readFile(file);
          if (!Buffer.isBuffer(current))
            throw new TypeError(`Cannot read ${file} as Buffer bytes.`);
          workingFiles.set(file, current);
        }
      }),
    );
  } catch (error) {
    return failed(
      [
        auditIssue(
          "input",
          `Dependency audit comparison inputs failed. Restore the required files or fetch and merge origin/main, then retry. ${auditCause(error)}`,
        ),
      ],
      comparisonCommit,
    );
  }
  if (
    AUDIT_INPUT_FILES.every((file) =>
      baseFiles.get(file).equals(workingFiles.get(file)),
    )
  )
    return { comparisonCommit, issues: annotate(headIssues, true) };

  const failures = [];
  let directory;
  let issues;
  let operation = "create";
  try {
    directory = await baseline.makeTemporaryDirectory();
    operation = "write";
    for (const file of AUDIT_INPUT_FILES.slice(0, 2))
      await directory.writeFile(file, baseFiles.get(file));
    operation = "audit";
    const result = await runAuditTree({
      command: auditCommandInDirectory(command, directory.path),
      runCommand,
      readFile: async (file) => baseFiles.get(file),
      now,
    });
    failures.push(
      ...result.evaluation.issues
        .filter((issue) => issue.kind === "input" || issue.kind === "report")
        .map((issue) => ({
          ...issue,
          message: `Dependency audit baseline ${comparisonCommit} failed. Check comparison inputs, npm and registry access, then retry. ${issue.message}`,
        })),
    );
    issues = headIssues.map((issue) => ({
      ...issue,
      inherited: inherited(issue, result.evaluation.issues),
    }));
  } catch (error) {
    failures.push(
      auditIssue(
        "input",
        `Dependency audit could not ${operation} the temporary baseline tree at ${comparisonCommit}. Check temporary files, npm and registry access, then retry. ${auditCause(error)}`,
      ),
    );
  } finally {
    if (directory)
      try {
        await directory.dispose();
      } catch (error) {
        failures.push(
          auditIssue(
            "input",
            `Dependency audit could not dispose of temporary files for ${comparisonCommit}. Check temporary file access and retry. ${auditCause(error)}`,
          ),
        );
      }
  }
  return failures.length
    ? failed(failures, comparisonCommit)
    : { comparisonCommit, issues };
}
