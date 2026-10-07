import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runAuditCommand } from "./dependency-audit-command.mjs";
import { renderPrBody } from "./dependency-audit-pr-body.mjs";
import { createPrGit, prFailureMessage } from "./dependency-audit-pr-git.mjs";
import { createPrGitHub } from "./dependency-audit-pr-github.mjs";
import {
  parsePrArguments,
  prConfiguration,
  readPrInputs,
} from "./dependency-audit-pr-input.mjs";

/** Maintain update pull requests using only the supplied IO, metadata and clock. */
export async function runDependencyAuditPr({
  args,
  env,
  cwd,
  readFile,
  clock,
  fetch,
  runCommand,
  logger,
}) {
  try {
    const options = parsePrArguments(args);
    const configuration = prConfiguration(env);
    const { summary, log, now } = await readPrInputs(options, readFile, clock);
    const body = renderPrBody({ log, now, configuration });
    const github = createPrGitHub(configuration, fetch);
    const git = createPrGit({ runCommand, cwd, env });
    const pulls = await github.openPullRequests();
    const branch = await git.inspectBranch();
    if (summary.ok) {
      for (const pull of pulls) await github.closePullRequest(pull.number);
      if (branch.tip && branch.botOnly) await git.deleteBranch(branch.tip);
      logger.notice(
        `Dependency audit is clean; ${pulls.length} update pull request(s) closed.${branch.tip && !branch.botOnly ? " Human commits were preserved." : ""}`,
      );
    } else {
      let previous;
      if (!branch.botOnly && pulls.length === 0) {
        previous = await github.closedPullRequestAt(branch.tip);
        if (previous === undefined)
          throw new Error(
            "dependency-audit/main contains human commits that no closed update pull request preserves. Ask a maintainer to delete the branch or reopen its pull request, then retry.",
          );
      }
      const recreate = branch.botOnly || previous !== undefined;
      if (recreate) {
        const packages = [
          ...new Set(
            summary.issues
              .filter((issue) => issue.kind === "finding")
              .map((issue) => issue.package),
          ),
        ];
        await git.updateBranch(packages, branch.tip);
      }
      await github.ensureLabel();
      if (pulls.length === 0) {
        const number = await github.createPullRequest(
          previous === undefined
            ? body
            : renderPrBody({ log, now, configuration, previous }),
        );
        await github.labelPullRequest(number);
      } else {
        for (const pull of pulls) {
          await github.replaceBody(pull.number, body);
          await github.labelPullRequest(pull.number);
        }
      }
      logger.notice(
        `Dependency audit update pull request maintained.${recreate ? "" : " Human commits were preserved."}${previous === undefined ? "" : ` The previous branch commits stay in #${previous}.`}`,
      );
    }
    return { ok: true };
  } catch (error) {
    logger.error(
      `Dependency audit update failed. ${prFailureMessage(error, env)} Fix the failed operation or input and retry.`,
    );
    return { ok: false };
  }
}

async function main() {
  const cwd = fileURLToPath(new URL("../../", import.meta.url));
  const result = await runDependencyAuditPr({
    args: process.argv.slice(2),
    env: process.env,
    cwd,
    readFile: (file) => fs.readFile(path.resolve(cwd, file), "utf8"),
    clock: () => new Date(),
    fetch: globalThis.fetch,
    runCommand: runAuditCommand,
    logger: {
      notice: (message) => process.stdout.write(`${message}\n`),
      error: (message) => process.stderr.write(`${message}\n`),
    },
  });
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
