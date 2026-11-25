import type { TimedJob } from "./ci-timing-jobs.mjs";

export interface PathSegment {
  job: TimedJob;
  /** From the end of the previous job on the path to the start of this job. */
  waitSeconds: number;
  runSeconds: number;
  /** From the start of the attempt to the completion of this job. */
  endSeconds: number;
}

export interface CriticalPath {
  startMs: number;
  endMs: number;
  wallSeconds: number;
  /** Jobs of this attempt that ran and were not skipped. */
  ranJobs: number;
  reusedJobs: number;
  segments: PathSegment[];
}

export function criticalPath(jobs: readonly TimedJob[]): CriticalPath | null;
