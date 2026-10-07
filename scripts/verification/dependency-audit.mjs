import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compareDependencyAudit } from "./dependency-audit-baseline.mjs";
import {
  npmAuditCommand,
  runAuditCommand,
} from "./dependency-audit-command.mjs";
import { runAuditTree } from "./dependency-audit-execution.mjs";
import {
  auditCause,
  auditEvaluation,
  auditIssue,
} from "./dependency-audit-issues.mjs";
import { GitWorkspace } from "./ratchets/git.mjs";

function parseArguments(args) {
  const options = { mode: "strict" };
  for (let index = 0; index < args.length; index++) {
    if (args[index] === "--baseline") options.mode = "baseline";
    else if (args[index] === "--report") {
      const file = args[++index];
      if (!file || file.startsWith("--"))
        throw new Error(
          "Dependency audit --report needs a file path. Supply --report <file> and retry.",
        );
      options.reportFile = file;
    } else
      throw new Error(
        `Unknown dependency audit argument ${args[index]}. Use only --baseline and --report <file>.`,
      );
  }
  return options;
}

function resultFor(mode, evaluation) {
  return {
    mode,
    ...evaluation,
    issues:
      mode === "baseline"
        ? evaluation.issues.map((issue) => ({ ...issue, inherited: false }))
        : evaluation.issues,
  };
}

function logResult(result, logger) {
  if (result.comparisonCommit)
    logger.notice(
      `Dependency audit comparison commit: ${result.comparisonCommit}`,
    );
  for (const notice of result.notices) logger.notice(notice);
  for (const issue of result.issues) {
    if (issue.inherited)
      logger.notice(
        `Inherited dependency audit issue at ${result.comparisonCommit}.\n${issue.message}\nAction: Fix this issue on main through the dependency update pull request.`,
      );
    else logger.error(issue.message);
  }
  if (!result.ok) return;
  if (result.comparisonCommit)
    logger.notice(
      `Dependency audit passed relative to ${result.comparisonCommit}; ${result.issues.length} inherited issue(s).`,
    );
  else if (result.notices.length === 0)
    logger.notice("Dependency audit passed; no exceptions in use.");
}

/** Run strict or baseline auditing with injected process, bytes, time and logs. */
export async function runDependencyAudit({
  args = [],
  command,
  runCommand,
  readFile,
  clock,
  logger,
  baseline,
  writeReport,
}) {
  let options;
  try {
    options = parseArguments(args);
  } catch (error) {
    const result = resultFor(
      args.includes("--baseline") ? "baseline" : "strict",
      auditEvaluation([auditIssue("input", auditCause(error))]),
    );
    logResult(result, logger);
    return result;
  }
  let result;
  try {
    const now = clock();
    const head = await runAuditTree({ command, runCommand, readFile, now });
    result = resultFor(options.mode, head.evaluation);
    if (
      options.mode === "baseline" &&
      result.issues.length &&
      !result.issues.some(
        (issue) => issue.kind === "report" || issue.kind === "input",
      )
    ) {
      const comparison = await compareDependencyAudit({
        head,
        command,
        runCommand,
        readFile,
        baseline,
        now,
      });
      Object.assign(result, comparison);
      result.ok = result.issues.every((issue) => issue.inherited);
    }
  } catch (error) {
    result = resultFor(
      options.mode,
      auditEvaluation([
        auditIssue(
          "input",
          `Dependency audit failed: ${auditCause(error)}. Retry after fixing command, registry, or input errors.`,
        ),
      ]),
    );
  }
  if (options.reportFile) {
    try {
      const summary = {
        mode: result.mode,
        ok: result.ok,
        issues: result.issues,
        ...(result.comparisonCommit
          ? { comparisonCommit: result.comparisonCommit }
          : {}),
      };
      await writeReport(options.reportFile, summary);
    } catch (error) {
      const issue = auditIssue(
        "input",
        `Cannot write dependency audit report ${options.reportFile}. Restore output file access and retry. ${auditCause(error)}`,
      );
      result.issues.push(
        result.mode === "baseline" ? { ...issue, inherited: false } : issue,
      );
      result.ok = false;
    }
  }
  logResult(result, logger);
  return result;
}

async function main() {
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const git = new GitWorkspace(root);
  const result = await runDependencyAudit({
    args: process.argv.slice(2),
    command: npmAuditCommand({
      npmExecPath: process.env.npm_execpath,
      nodeExecPath: process.execPath,
      cwd: root,
      platform: process.platform,
      env: process.env,
    }),
    runCommand: runAuditCommand,
    readFile: (file) => fs.readFile(path.join(root, file)),
    clock: () => new Date(),
    writeReport: (file, summary) =>
      fs.writeFile(
        path.resolve(root, file),
        `${JSON.stringify(summary, null, 2)}\n`,
      ),
    logger: {
      notice: (message) => process.stdout.write(`${message}\n`),
      error: (message) => process.stderr.write(`${message}\n`),
    },
    baseline: {
      resolveComparisonCommit: async () => git.requireBase(),
      readRevision: async (commit, file) => git.readRevision(commit, file),
      makeTemporaryDirectory: async () => {
        const directory = await fs.mkdtemp(
          path.join(os.tmpdir(), "mokly-dependency-audit-"),
        );
        return {
          path: directory,
          writeFile: (file, contents) =>
            fs.writeFile(path.join(directory, file), contents),
          dispose: () => fs.rm(directory, { recursive: true, force: true }),
        };
      },
    },
  });
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
