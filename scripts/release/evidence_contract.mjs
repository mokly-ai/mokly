export const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";
export const REQUIRED_CI_JOB_NAME = "Required CI";
export const VERIFICATION_ARTIFACT_PATTERN = /^verification-/;
export const VERIFICATION_REPORT_COUNT = 16;
export const RELEASE_VERIFICATION_RUNTIMES = Object.freeze([
  "node-22.14.0",
  "node-24",
]);

const SHA_PATTERN = /^[a-f0-9]{40}$/;

export function resolveVerificationMode({ eventName, manualVerification }) {
  if (eventName === "push") return "evidence";
  if (eventName !== "workflow_dispatch")
    throw new Error(`unsupported release event: ${eventName}`);
  const mode = manualVerification || "evidence";
  if (!["evidence", "complete"].includes(mode))
    throw new Error(`unsupported release verification mode: ${mode}`);
  return mode;
}

export function selectCandidateRuns(runs, pulls, tagCommit, repository) {
  const normalizedRepository = repository.toLowerCase();
  const pullHeads = new Set(
    pulls
      .filter(
        (pull) =>
          pull.merged_at &&
          pull.merge_commit_sha === tagCommit &&
          pull.head?.repo?.full_name?.toLowerCase() === normalizedRepository,
      )
      .map((pull) => pull.head.sha),
  );
  const eligible = runs.filter(
    (run) =>
      run.status === "completed" &&
      run.conclusion === "success" &&
      run.path === CI_WORKFLOW_PATH &&
      run.head_repository?.full_name?.toLowerCase() === normalizedRepository,
  );
  const pushes = newestFirst(
    eligible.filter(
      (run) => run.event === "push" && run.head_sha === tagCommit,
    ),
  );
  const pullRequests = newestFirst(
    eligible.filter(
      (run) => run.event === "pull_request" && pullHeads.has(run.head_sha),
    ),
  );
  const seen = new Set();
  return [...pushes, ...pullRequests].filter((run) => {
    if (seen.has(run.id)) return false;
    seen.add(run.id);
    return true;
  });
}

export function classifyCandidate({ run, jobs, artifacts }) {
  const requiredJobs = jobs.filter((job) => job.name === REQUIRED_CI_JOB_NAME);
  if (requiredJobs.length !== 1 || requiredJobs[0]?.conclusion !== "success")
    return absent(
      `run ${run.id} has no successful ${REQUIRED_CI_JOB_NAME} job`,
    );
  const reports = artifacts.filter((artifact) =>
    VERIFICATION_ARTIFACT_PATTERN.test(artifact.name),
  );
  if (
    reports.length !== VERIFICATION_REPORT_COUNT ||
    new Set(reports.map((artifact) => artifact.name)).size !== reports.length
  )
    return absent(
      `run ${run.id} has ${reports.length} verification artifacts; expected ${VERIFICATION_REPORT_COUNT}`,
    );
  if (reports.some((artifact) => artifact.expired))
    return absent(`run ${run.id} has expired verification artifacts`);
  return {
    outcome: "applicable",
    reason: "candidate artifacts are available",
    reports,
  };
}

export function findEvidenceCommit(reports) {
  const commits = new Set(reports.map((report) => report?.commit));
  if (commits.size !== 1)
    return invalid(
      "verification reports do not name one commit",
      reports.length,
    );
  const [commit] = commits;
  if (typeof commit !== "string" || !SHA_PATTERN.test(commit))
    return invalid(
      "verification reports name an invalid commit",
      reports.length,
    );
  return { outcome: "applicable", commit };
}

export function classifyEvidence(input, validateReports) {
  const available = classifyCandidate(input);
  if (available.outcome !== "applicable") return available;
  if (input.reports.length !== VERIFICATION_REPORT_COUNT)
    return invalid(
      `downloaded ${input.reports.length} reports; expected ${VERIFICATION_REPORT_COUNT}`,
      input.reports.length,
    );
  const identity = findEvidenceCommit(input.reports);
  if (identity.outcome !== "applicable") return identity;
  if (
    identity.commit !== input.taggedCommit &&
    input.evidenceTree !== input.taggedTree
  )
    return {
      ...absent(
        `evidence commit ${identity.commit} does not match the tagged tree`,
      ),
      evidenceCommit: identity.commit,
      reportCount: input.reports.length,
    };
  try {
    validateReports(
      input.reports,
      identity.commit,
      RELEASE_VERIFICATION_RUNTIMES,
    );
  } catch (error) {
    return invalid(
      `CI report aggregate is invalid: ${errorMessage(error)}`,
      input.reports.length,
      identity.commit,
    );
  }
  const liveInventory = sorted(input.liveUnitFiles);
  const mismatched = input.reports
    .filter((report) => report.suite === "unit")
    .some(
      (report) =>
        sorted(report.fullFiles).join("\n") !== liveInventory.join("\n"),
    );
  if (mismatched)
    return invalid(
      "unit report inventory does not match the release checkout",
      input.reports.length,
      identity.commit,
    );
  return {
    outcome: "applicable",
    reason: `run ${input.run.id} proves tagged tree ${input.taggedTree}`,
    evidenceCommit: identity.commit,
    reportCount: input.reports.length,
  };
}

function newestFirst(runs) {
  return [...runs].sort((left, right) => {
    const date = String(right.updated_at ?? right.created_at).localeCompare(
      String(left.updated_at ?? left.created_at),
    );
    return date || Number(right.id) - Number(left.id);
  });
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function absent(reason) {
  return { outcome: "absent", reason };
}

function invalid(reason, reportCount, evidenceCommit) {
  return { outcome: "invalid", reason, reportCount, evidenceCommit };
}

export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
