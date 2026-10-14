import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { TestContext } from "node:test";

import type { releaseRun } from "./release_evidence.js";
import {
  requiredJobs,
  verificationArtifacts,
  TAG_TREE,
} from "./release_evidence.js";

export function githubFixture(run: ReturnType<typeof releaseRun>) {
  return {
    listPulls: async () => ({ outcome: "applicable" as const, value: [] }),
    listRuns: async (event: string) => ({
      outcome: "applicable" as const,
      value: event === "push" ? [run] : [],
    }),
    listJobs: async () => ({
      outcome: "applicable" as const,
      value: requiredJobs(),
    }),
    listArtifacts: async () => ({
      outcome: "applicable" as const,
      value: verificationArtifacts(),
    }),
    downloadArtifact: async () => ({ outcome: "applicable" as const }),
    readCommitTree: async () => ({
      outcome: "applicable" as const,
      value: TAG_TREE,
    }),
  };
}

export function evidenceEnvironment(output: string) {
  return {
    RELEASE_VERIFICATION: "evidence",
    GITHUB_TOKEN: "token",
    GITHUB_REPOSITORY: "mokly-ai/mokly",
    GITHUB_SERVER_URL: "https://github.com",
    GITHUB_OUTPUT: output,
  };
}

export async function temporaryRoot(t: TestContext): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "mokly-evidence-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
