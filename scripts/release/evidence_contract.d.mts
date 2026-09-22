export type EvidenceOutcome = "applicable" | "absent" | "invalid";

export interface WorkflowRun {
  id: number;
  event: string;
  status: string;
  conclusion: string | null;
  path: string;
  head_sha: string;
  head_repository?: { full_name?: string } | null;
  created_at?: string;
  updated_at?: string;
  html_url?: string;
}

export interface AssociatedPull {
  merged_at?: string | null;
  merge_commit_sha?: string | null;
  head?: {
    sha: string;
    repo?: { full_name?: string } | null;
  };
}

export interface WorkflowJob {
  name: string;
  conclusion?: string | null;
}

export interface VerificationArtifact {
  id: number;
  name: string;
  expired?: boolean;
}

export interface VerificationReport {
  commit?: string;
  suite?: string;
  fullFiles?: string[];
  [key: string]: unknown;
}

export interface EvidenceResult {
  outcome: EvidenceOutcome;
  reason?: string;
  evidenceCommit?: string;
  reportCount?: number;
  reports?: VerificationArtifact[];
}

export const CI_WORKFLOW_PATH: string;
export const REQUIRED_CI_JOB_NAME: string;
export const VERIFICATION_ARTIFACT_PATTERN: RegExp;
export const VERIFICATION_REPORT_COUNT: number;
export const RELEASE_VERIFICATION_RUNTIMES: readonly [
  "node-22.14.0",
  "node-24",
];

export function resolveVerificationMode(input: {
  eventName: string;
  manualVerification: string;
}): "evidence" | "complete";

export function selectCandidateRuns(
  runs: readonly WorkflowRun[],
  pulls: readonly AssociatedPull[],
  tagCommit: string,
  repository: string,
): WorkflowRun[];

export function classifyCandidate(input: {
  run: WorkflowRun;
  jobs: readonly WorkflowJob[];
  artifacts: readonly VerificationArtifact[];
}): EvidenceResult;

export function findEvidenceCommit(
  reports: readonly VerificationReport[],
): EvidenceResult & { commit?: string };

export function classifyEvidence(
  input: {
    run: WorkflowRun;
    jobs: readonly WorkflowJob[];
    artifacts: readonly VerificationArtifact[];
    reports: readonly VerificationReport[];
    taggedCommit: string;
    taggedTree: string;
    evidenceTree: string;
    liveUnitFiles: readonly string[];
  },
  validateReports: (
    reports: readonly unknown[],
    commit: string,
    runtimes: readonly string[],
  ) => void,
): EvidenceResult;

export function errorMessage(error: unknown): string;
