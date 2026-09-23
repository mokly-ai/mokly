import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { validateCiReports, readReports } from "../verification/aggregate.mjs";
import { discoverUnitFiles } from "../verification/evidence.mjs";

import {
  classifyCandidate,
  classifyEvidence,
  errorMessage,
  findEvidenceCommit,
  resolveVerificationMode,
  selectCandidateRuns,
} from "./evidence_contract.mjs";
import { createEvidenceGithub } from "./evidence_github.mjs";
import {
  finishEvidence,
  readGitIdentity,
  writeReleaseFile,
} from "./evidence_record.mjs";

const defaultExecute = promisify(execFile);

export async function runReleaseEvidence(options = {}) {
  const env = options.env ?? process.env;
  const repositoryRoot = options.repositoryRoot ?? process.cwd();
  const execute = options.execute ?? defaultExecute;
  const write = options.write ?? writeReleaseFile;
  const identity = await readGitIdentity(repositoryRoot, execute);
  if (!env.RELEASE_VERIFICATION)
    throw new Error("RELEASE_VERIFICATION must be evidence or complete");
  const mode = resolveVerificationMode({
    eventName: "workflow_dispatch",
    manualVerification: env.RELEASE_VERIFICATION,
  });
  if (mode === "complete")
    return await finishEvidence(
      {
        outcome: "complete",
        reason: "complete verification was explicitly requested",
      },
      identity,
      undefined,
      { env, repositoryRoot, write, writeOutput: options.writeOutput },
    );

  if (!env.GITHUB_TOKEN)
    throw new Error("GITHUB_TOKEN is required in evidence mode");
  if (!env.GITHUB_REPOSITORY)
    throw new Error("GITHUB_REPOSITORY is required in evidence mode");
  const token = env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  const github = (options.createGithub ?? createEvidenceGithub)({
    token,
    repository,
    serverUrl: env.GITHUB_SERVER_URL || "https://github.com",
    fetch: options.fetch,
    execute,
    write,
  });
  const candidateResult = await loadCandidates(
    github,
    identity.taggedCommit,
    repository,
  );
  if (candidateResult.outcome !== "applicable")
    return await finishEvidence(candidateResult, identity, undefined, {
      env,
      repositoryRoot,
      write,
      writeOutput: options.writeOutput,
    });

  let last = {
    outcome: "absent",
    reason: "no applicable CI evidence was found",
  };
  let selected;
  for (const run of candidateResult.runs) {
    selected = run;
    const result = await evaluateCandidate({
      github,
      run,
      identity,
      repositoryRoot,
      validateReports: options.validateReports ?? validateCiReports,
      read: options.readReports ?? readReports,
      discover: options.discoverUnitFiles ?? discoverUnitFiles,
    });
    if (result.outcome === "applicable") {
      last = result;
      break;
    }
    last = result;
    if (result.outcome === "invalid") break;
  }
  const record = await finishEvidence(last, identity, selected, {
    env,
    repositoryRoot,
    write,
    writeOutput: options.writeOutput,
  });
  if (last.outcome === "invalid") throw new Error(last.reason);
  return record;
}

async function loadCandidates(github, tagCommit, repository) {
  const pulls = await github.listPulls(tagCommit);
  if (pulls.outcome !== "applicable") return pulls;
  const pushRuns = await github.listRuns("push", tagCommit);
  if (pushRuns.outcome !== "applicable") return pushRuns;
  const heads = new Set(
    pulls.value
      .filter(
        (pull) =>
          pull.merged_at &&
          pull.merge_commit_sha === tagCommit &&
          pull.head?.repo?.full_name?.toLowerCase() ===
            repository.toLowerCase(),
      )
      .map((pull) => pull.head.sha),
  );
  const runs = [...pushRuns.value];
  for (const head of heads) {
    const result = await github.listRuns("pull_request", head);
    if (result.outcome !== "applicable") return result;
    runs.push(...result.value);
  }
  return {
    outcome: "applicable",
    runs: selectCandidateRuns(runs, pulls.value, tagCommit, repository),
  };
}

async function evaluateCandidate(input) {
  const jobs = await input.github.listJobs(input.run.id);
  if (jobs.outcome !== "applicable") return jobs;
  const artifacts = await input.github.listArtifacts(input.run.id);
  if (artifacts.outcome !== "applicable") return artifacts;
  const availability = classifyCandidate({
    run: input.run,
    jobs: jobs.value,
    artifacts: artifacts.value,
  });
  if (availability.outcome !== "applicable") return availability;

  const reportsRoot = path.join(
    input.repositoryRoot,
    ".context/release-evidence/reports",
  );
  await fs.rm(reportsRoot, { recursive: true, force: true });
  await fs.mkdir(reportsRoot, { recursive: true });
  for (const artifact of availability.reports) {
    const result = await input.github.downloadArtifact(
      artifact,
      path.join(reportsRoot, artifact.name),
    );
    if (result.outcome !== "applicable") return result;
  }
  let reports;
  try {
    reports = await input.read(reportsRoot);
  } catch (error) {
    return {
      outcome: "invalid",
      reason: `verification reports cannot be read: ${errorMessage(error)}`,
    };
  }
  const evidence = findEvidenceCommit(reports);
  if (evidence.outcome !== "applicable") return evidence;
  let evidenceTree = input.identity.taggedTree;
  if (evidence.commit !== input.identity.taggedCommit) {
    const tree = await input.github.readCommitTree(evidence.commit);
    if (tree.outcome !== "applicable") return tree;
    evidenceTree = tree.value;
  }
  const liveUnitFiles = await input.discover(input.repositoryRoot);
  return classifyEvidence(
    {
      run: input.run,
      jobs: jobs.value,
      artifacts: artifacts.value,
      reports,
      taggedCommit: input.identity.taggedCommit,
      taggedTree: input.identity.taggedTree,
      evidenceTree,
      liveUnitFiles,
    },
    input.validateReports,
  );
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
)
  await runReleaseEvidence();
