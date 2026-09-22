import { ciReports } from "./verification_evidence.js";

export const TAG_COMMIT = "a".repeat(40);
export const TAG_TREE = "b".repeat(40);

export function releaseRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 101,
    event: "push",
    status: "completed",
    conclusion: "success",
    path: ".github/workflows/ci.yml",
    head_sha: TAG_COMMIT,
    head_repository: { full_name: "mokly-ai/mokly" },
    created_at: "2026-09-22T10:00:00Z",
    updated_at: "2026-09-22T10:10:00Z",
    html_url: "https://github.com/mokly-ai/mokly/actions/runs/101",
    ...overrides,
  };
}

export function verificationArtifacts(expired = false) {
  return Array.from({ length: 16 }, (_, index) => ({
    id: index + 1,
    name: `verification-report-${index + 1}`,
    expired,
  }));
}

export function requiredJobs(conclusion = "success") {
  return [{ name: "Required CI", conclusion }];
}

export function releaseReports(commit = TAG_COMMIT) {
  return ciReports().map((report) => ({ ...report, commit }));
}

export function unitInventory(reports = releaseReports()): string[] {
  const report = reports.find((candidate) => candidate.suite === "unit");
  if (!report) throw new Error("test fixture has no unit report");
  return [...report.fullFiles];
}

export function gitExecutor(commit = TAG_COMMIT, tree = TAG_TREE) {
  return async (_command: string, args: string[]) => ({
    stdout: `${args[1] === "HEAD" ? commit : tree}\n`,
    stderr: "",
  });
}
