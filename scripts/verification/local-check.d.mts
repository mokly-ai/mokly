export class SnapshotUnavailableError extends Error {}

export interface LocalVerificationTask {
  key: string;
  suite: "repository" | "package" | "unit" | "browser";
  index?: number;
  port?: number;
  snapshot?: string;
}

export function runCompleteLocal(root: string): Promise<void>;
export function verificationTasks(): LocalVerificationTask[];
export function localWorkerLimit(available: number): number;
export function primaryCheckError(error: Error, interrupted?: Error): Error;
export function collectWorkerReport(
  source: string,
  destination: string,
  required: boolean,
): Promise<Record<string, unknown> | undefined>;
export function workerFailure(
  key: string,
  outcome: {
    exitCode: number | null;
    signal: string | null;
    interrupted?: string | null;
  },
  report?: { failures?: Array<{ name: string; diagnostic: string }> },
): Error;
