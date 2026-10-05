import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { evaluateDependencyAudit } from "./dependency-audit-evaluation.mjs";

const AUDIT_ARGUMENTS = [
  "audit",
  "--json",
  "--audit-level=low",
  "--include=prod",
  "--include=dev",
  "--include=optional",
  "--include=peer",
];
const EXCEPTIONS_FILE = "scripts/verification/dependency-audit-exceptions.json";

/** Use npm's current CLI through Node, including on macOS and Windows. */
export function npmAuditCommand({ npmExecPath, nodeExecPath, cwd, platform }) {
  return {
    file: npmExecPath ? nodeExecPath : "npm",
    args: npmExecPath
      ? [npmExecPath, ...AUDIT_ARGUMENTS]
      : [...AUDIT_ARGUMENTS],
    cwd,
    shell: !npmExecPath && platform === "win32",
  };
}

function parseJson(contents, source) {
  try {
    return { value: JSON.parse(contents), errors: [] };
  } catch (error) {
    return {
      value: undefined,
      errors: [
        `Invalid JSON in ${source}. Fix the file or restore registry access and retry. ${error.message}`,
      ],
    };
  }
}

async function readJson(readFile, file) {
  let contents;
  try {
    contents = await readFile(file);
  } catch (error) {
    return {
      value: undefined,
      errors: [
        `Cannot read ${file}. Restore the file and retry. ${error.message}`,
      ],
    };
  }
  return parseJson(contents, file);
}

/** Run the workspace gate through injected commands, file reads, time and logs. */
export async function runDependencyAudit({
  command,
  runCommand,
  readFile,
  clock,
  logger,
}) {
  let evaluation;
  try {
    const outcome = await runCommand(command);
    const parsed = parseJson(outcome.stdout, "npm registry audit output");
    const [lockfile, exceptions] = await Promise.all([
      readJson(readFile, "package-lock.json"),
      readJson(readFile, EXCEPTIONS_FILE),
    ]);
    const report = parsed.value;
    evaluation = evaluateDependencyAudit(
      report,
      lockfile.value,
      exceptions.value,
      clock(),
    );
    evaluation.errors.push(
      ...parsed.errors,
      ...lockfile.errors,
      ...exceptions.errors,
    );
    if (outcome.signal || (outcome.exitCode !== 0 && outcome.exitCode !== 1)) {
      evaluation.errors.push(
        `Unexpected npm audit exit status ${outcome.exitCode}; signal: ${outcome.signal ?? "none"}. Check npm and registry access, then retry. ${outcome.stderr}`,
      );
    } else if (evaluation.ok) {
      const hasFindings = Object.values(report.vulnerabilities).some(
        (entry) => entry.severity !== "info",
      );
      if (outcome.exitCode !== (hasFindings ? 1 : 0))
        evaluation.errors.push(
          `Unexpected npm audit exit status ${outcome.exitCode} for this report. Check npm and registry output, then retry.`,
        );
    }
    evaluation.ok = evaluation.errors.length === 0;
  } catch (error) {
    evaluation = {
      ok: false,
      errors: [
        `Dependency audit failed: ${error.message}. Retry after fixing command, registry, or input errors.`,
      ],
      notices: [],
    };
  }
  for (const notice of evaluation.notices) logger.notice(notice);
  for (const error of evaluation.errors) logger.error(error);
  if (evaluation.ok && evaluation.notices.length === 0)
    logger.notice("Dependency audit passed; no exceptions in use.");
  return evaluation;
}

function runCommand(command) {
  return new Promise((resolve, reject) => {
    const child = spawn(command.file, command.args, {
      cwd: command.cwd,
      shell: command.shell,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (exitCode, signal) =>
      resolve({
        exitCode,
        signal,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      }),
    );
  });
}

async function main() {
  const root = new URL("../../", import.meta.url);
  const result = await runDependencyAudit({
    command: npmAuditCommand({
      npmExecPath: process.env.npm_execpath,
      nodeExecPath: process.execPath,
      cwd: fileURLToPath(root),
      platform: process.platform,
    }),
    runCommand,
    readFile: (file) => fs.readFile(new URL(file, root), "utf8"),
    clock: () => new Date(),
    logger: {
      notice: (message) => process.stdout.write(`${message}\n`),
      error: (message) => process.stderr.write(`${message}\n`),
    },
  });
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
