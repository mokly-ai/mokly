import type {
  AssociatedPull,
  EvidenceResult,
  VerificationArtifact,
  WorkflowJob,
  WorkflowRun,
} from "./evidence_contract.mjs";

export interface GithubResult<T> {
  outcome: "applicable" | "absent" | "invalid";
  reason?: string;
  value?: T;
}

export interface EvidenceGithub {
  listPulls(commit: string): Promise<GithubResult<AssociatedPull[]>>;
  listRuns(
    event: string,
    headSha: string,
  ): Promise<GithubResult<WorkflowRun[]>>;
  listJobs(runId: number): Promise<GithubResult<WorkflowJob[]>>;
  listArtifacts(runId: number): Promise<GithubResult<VerificationArtifact[]>>;
  readCommitTree(commit: string): Promise<GithubResult<string>>;
  downloadArtifact(
    artifact: VerificationArtifact,
    destination: string,
  ): Promise<EvidenceResult>;
}

export function createEvidenceGithub(options: {
  token: string;
  repository: string;
  serverUrl: string;
  fetch?: typeof globalThis.fetch;
  execute?: (
    command: string,
    args: string[],
  ) => Promise<{ stderr: string; stdout: string }>;
  write?: (file: string, bytes: Uint8Array) => Promise<void>;
}): EvidenceGithub;

export function githubApiRoot(serverUrl: string): string;
