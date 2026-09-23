import fs from "node:fs/promises";
import path from "node:path";

import { writeWorkflowOutput } from "./context.mjs";

export async function readGitIdentity(repositoryRoot, execute) {
  const taggedCommit = (
    await execute("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot })
  ).stdout.trim();
  const taggedTree = (
    await execute("git", ["rev-parse", "HEAD^{tree}"], {
      cwd: repositoryRoot,
    })
  ).stdout.trim();
  return { taggedCommit, taggedTree };
}

export async function finishEvidence(
  result,
  identity,
  run,
  { env, repositoryRoot, write = writeReleaseFile, writeOutput },
) {
  const mode = result.outcome === "applicable" ? "evidence" : "complete";
  const record = {
    mode,
    outcome: result.outcome,
    taggedCommit: identity.taggedCommit,
    taggedTree: identity.taggedTree,
    selectedRunId: run?.id ?? null,
    selectedRunUrl: run?.html_url ?? null,
    evidenceCommit: result.evidenceCommit ?? null,
    reportCount: result.reportCount ?? 0,
    reason: result.reason,
  };
  await write(
    path.join(repositoryRoot, ".context/release-evidence/record.json"),
    `${JSON.stringify(record, null, 2)}\n`,
  );
  (writeOutput ?? writeWorkflowOutput)("mode", mode, env.GITHUB_OUTPUT);
  process.stdout.write(`${result.outcome}: ${result.reason}\n`);
  return record;
}

export async function writeReleaseFile(file, contents) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, contents);
}
