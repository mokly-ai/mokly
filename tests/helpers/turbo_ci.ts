import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

import { repositoryRoot } from "./fixture.js";

export const mainCacheCondition =
  "github.event_name == 'push' && github.ref == 'refs/heads/main'";
export const prCacheCondition =
  "github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository";
export const trustedCacheEnvironment = {
  name: "${{ github.event_name == 'push' && github.ref == 'refs/heads/main' && 'turbo-cache-trusted' || '' }}",
  deployment: false,
};

export interface CacheStep {
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
}

export interface CacheJob {
  if?: string;
  needs?: string[];
  environment?: string | { name: string; deployment?: boolean };
  steps: CacheStep[];
}

export interface CacheWorkflow {
  on: Record<string, unknown> | readonly string[] | string;
  env?: Record<string, string>;
  jobs: Record<string, CacheJob>;
}

export async function readCacheWorkflow(name: string): Promise<CacheWorkflow> {
  return parse(
    await fs.readFile(
      path.join(repositoryRoot, ".github/workflows", name),
      "utf8",
    ),
  ) as CacheWorkflow;
}

export function credentialSteps(job: CacheJob): CacheStep[] {
  return job.steps.filter(
    (step) =>
      step.name?.startsWith("Configure ") && step.name.endsWith("Turbo cache"),
  );
}
