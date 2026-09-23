import type { VerificationReport, WorkflowRun } from "./evidence_contract.mjs";
import type { EvidenceGithub } from "./evidence_github.mjs";

export interface EvidenceRecord {
  mode: "evidence" | "complete";
  outcome: "applicable" | "absent" | "invalid" | "complete";
  taggedCommit: string;
  taggedTree: string;
  selectedRunId: number | null;
  selectedRunUrl: string | null;
  evidenceCommit: string | null;
  reportCount: number;
  reason: string;
}

export interface ReleaseEvidenceOptions {
  env?: Readonly<Record<string, string | undefined>>;
  repositoryRoot?: string;
  execute?: (
    command: string,
    args: string[],
    options?: { cwd: string },
  ) => Promise<{ stderr: string; stdout: string }>;
  write?: (file: string, contents: string | Uint8Array) => Promise<void>;
  writeOutput?: (name: string, value: string, outputPath?: string) => void;
  fetch?: typeof globalThis.fetch;
  createGithub?: (options: unknown) => EvidenceGithub;
  validateReports?: (
    reports: readonly unknown[],
    commit: string,
    runtimes: readonly string[],
  ) => void;
  readReports?: (root: string) => Promise<VerificationReport[]>;
  discoverUnitFiles?: (root: string) => Promise<string[]>;
}

export function runReleaseEvidence(
  options?: ReleaseEvidenceOptions,
): Promise<EvidenceRecord>;

export type { WorkflowRun };
