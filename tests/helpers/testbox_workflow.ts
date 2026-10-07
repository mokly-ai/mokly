import fs from "node:fs/promises";
import path from "node:path";

import { parse } from "yaml";

import { repositoryRoot } from "./fixture.js";

export interface TestboxWorkflowStep {
  name: string;
  uses?: string;
  run?: string;
  with?: Readonly<Record<string, unknown>>;
}

export interface TestboxWorkflowJob {
  name: string;
  "runs-on": string;
  "timeout-minutes": number;
  steps: readonly TestboxWorkflowStep[];
  needs?: readonly string[];
  permissions?: Readonly<Record<string, string>>;
}

export interface TestboxWorkflow {
  on: {
    push: { branches: readonly string[]; paths: readonly string[] };
    workflow_dispatch: {
      inputs: Readonly<
        Record<string, { required: boolean; default: string; type?: string }>
      >;
    };
  };
  permissions: Readonly<Record<string, string>>;
  env: Readonly<Record<string, string>>;
  jobs: Readonly<Record<string, TestboxWorkflowJob>>;
}

export async function readTestboxWorkflow(file = "blacksmith-testbox.yml") {
  const source = await fs.readFile(
    path.join(repositoryRoot, ".github/workflows", file),
    "utf8",
  );
  return { source, workflow: parse(source) as TestboxWorkflow };
}
