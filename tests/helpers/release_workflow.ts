import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { repositoryRoot } from "./fixture.js";
import type { PackageReport } from "./release_fixture.js";

interface WorkflowStep {
  env?: Readonly<Record<string, string>>;
  id?: string;
  if?: string;
  name?: string;
  run?: string;
  uses?: string;
  with?: Readonly<Record<string, unknown>>;
}

interface WorkflowJob {
  env?: Readonly<Record<string, string>>;
  environment?: string;
  if?: string;
  name?: string;
  needs?: readonly string[];
  outputs?: Readonly<Record<string, string>>;
  permissions?: Readonly<Record<string, string>>;
  "runs-on"?: string;
  steps: readonly WorkflowStep[];
  strategy?: {
    "fail-fast"?: boolean;
    matrix: Readonly<Record<string, readonly (string | number)[]>>;
  };
}

export interface Workflow {
  concurrency: { "cancel-in-progress": boolean };
  jobs: Readonly<Record<string, WorkflowJob>>;
  on: Readonly<Record<string, unknown>>;
  permissions: Readonly<Record<string, string>>;
}

export interface WorkflowDispatch {
  inputs: Readonly<
    Record<
      string,
      {
        default?: string;
        options?: readonly string[];
        required?: boolean;
        type?: string;
      }
    >
  >;
}

interface ReleaseContextModule {
  remoteTagCommit(output: string, ref: string): string;
  resolvePublishRefs(input: {
    eventName: string;
    manualRef: string;
    manualViewerRef: string;
    releaseCreated: string;
    releaseTag: string;
    viewerReleaseCreated: string;
    viewerReleaseTag: string;
  }): { cli: string; viewer: string } | undefined;
  validateTagVersion(ref: string, version: string): void;
}

interface RegistryContractModule {
  comparePublishedPackage(
    local: PackageReport,
    remote: PackageReport,
    metadata: { gitHead?: string },
    commit: string,
  ): void;
  isMissingPackage(result: {
    code: number | null;
    stderr: string;
    stdout: string;
  }): boolean;
}

export async function workflowSource(name: string): Promise<string> {
  return await fs.promises.readFile(
    path.join(repositoryRoot, ".github", "workflows", name),
    "utf8",
  );
}

export function assertPinnedActions(workflow: Workflow): void {
  const actions = Object.values(workflow.jobs).flatMap((job) =>
    job.steps.flatMap((step) => (step.uses ? [step.uses] : [])),
  );
  assert.ok(actions.length > 0);
  for (const action of actions) assert.match(action, /@[a-f0-9]{40}$/);
}

export async function releaseContext(): Promise<ReleaseContextModule> {
  const url = pathToFileURL(
    path.join(repositoryRoot, "scripts/release/context.mjs"),
  ).href;
  return (await import(url)) as ReleaseContextModule;
}

export async function registryContract(): Promise<RegistryContractModule> {
  const url = pathToFileURL(
    path.join(repositoryRoot, "scripts/release/registry_contract.mjs"),
  ).href;
  return (await import(url)) as RegistryContractModule;
}
