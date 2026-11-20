import type { CheckoutHead } from "./build-output";
import {
  buildingPullRequest,
  closedPullRequest,
  publication,
  pullRequest,
} from "./publications";

export const sydney = { kind: "branch", name: publication.branch } as const;

export const main = { kind: "branch", name: "main" } as const;

export const firna = {
  kind: "branch",
  name: "calummoore/firna-controls",
} as const;

export const protocol = {
  kind: "branch",
  name: "calummoore/protocol-docs",
} as const;

export const rotation = {
  kind: "branch",
  name: "alex/token-rotation",
} as const;

export const bun = { kind: "branch", name: "alex/bun-migration" } as const;

export const initialScope = {
  kind: "pull-request",
  number: pullRequest.number,
  title: pullRequest.title,
  author: pullRequest.author,
  github: pullRequest.github,
} as const;

export const hosting = {
  kind: "pull-request",
  ...buildingPullRequest,
} as const;

export const uploads = { kind: "pull-request", ...closedPullRequest } as const;

/** One checkout head; every branch but the default compares against it. */
export function head(sha: string, branch: string): CheckoutHead {
  return { head: sha, branch, compared: branch !== "main" };
}

export const heads = {
  running: head("5d2e9a1c3f7b48e09a6d21c4b8f03e7a5d9c1b62", sydney.name),
  published: head("72d6047e8b1c5a93f0d24e6b7a1c8f35e09d4b21", sydney.name),
  failed: head("8b3f0c2a6e91d47b3c05f8a2e6d19b47c3a0f5e8", sydney.name),
  timedOut: head(
    "e5a9b20d7c3f16a84e2b09d5c7f3a1e68b4d2c07",
    "alex/initial-scope",
  ),
  infrastructure: head("2a6c8f1e4b97d03a5c28e1f6b9d4a07c3e52f8b1", main.name),
  plan: head("9e4d3b7a1c58f02e6b93d4a7c1e85f03b26d9a4c", firna.name),
  version: head("0c5e8a3f6d21b97c4e05a8f3d1b6c29e7a43f0d5", protocol.name),
  lockfile: head("4c19e7b2a8d03f56e1b9c4a72d8f05e3b6a1c94d", bun.name),
  superseded: head("c47e1d9b2f85a03c6e1d97b4a2f08c5e3d16b9a4", sydney.name),
  cancelled: head("f2b81d4c9e36a07b5d18f2c4e9a63b07d5c1e8f2", rotation.name),
  queued: head("7a3c9e5b1d84f26c0e7a39d5b2f18c4e6a07d3b9", rotation.name),
  setup: head("1d7a4c9e2b65f08d3a17c4e9b5d26f0a8c3e1b74", main.name),
  pullRequest: head(
    "b7d3e10a5c92f47e1b08d3c6a9e24f5b7d1c0e83",
    "calummoore/catalogue-hosting",
  ),
  closed: head(
    "55ed5673fe828c95ae76c3cc5e39db4e1ac35daf",
    "alex/retry-uploads",
  ),
} as const;
