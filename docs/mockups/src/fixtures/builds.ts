import type { CheckoutHead, OutputEntry } from "./build-output";
import {
  checkoutOutput,
  cliOutput,
  elidedInstallOutput,
  fetchingOutput,
  installOutput,
  lockfileMismatchOutput,
  publishedOutput,
  publishingOutput,
  publishStoppedOutput,
  unreachableOutput,
  unsupportedLockfileOutput,
} from "./build-output";
import {
  buildingPullRequest,
  closedPullRequest,
  publication,
  pullRequest,
} from "./publications";

/** A build's lifecycle state, as the build API reports it. */
export type BuildState =
  | "queued"
  | "running"
  | "published"
  | "failed"
  | "timed-out"
  | "superseded"
  | "cancelled";

/** The three steps every build runs, in order, with the names its card shows. */
export const buildSteps = [
  { id: "checkout", name: "Check out" },
  { id: "install", name: "Install" },
  { id: "publish", name: "Publish" },
] as const;

/** One step of a build. */
export type BuildStep = (typeof buildSteps)[number]["id"];

/** The cause a failed or timed-out build ended with. */
export type BuildCause =
  | "exit"
  | "upload-rejected"
  | "unsupported-lockfile"
  | "unsupported-mokly-version"
  | "uncommitted-changes"
  | "output-limit"
  | "deadline"
  | "idle"
  | "plan-required"
  | "infrastructure"
  | "repository-unavailable";

/** A branch or pull request a build publishes, as its card and chrome name it. */
export type BuildReference =
  | { kind: "branch"; name: string }
  | {
      kind: "pull-request";
      number: string;
      title: string;
      author: string;
      github: string;
    };

/** One build, with what its card and its history row read. */
export interface FixtureBuild {
  reference: BuildReference;
  checkout: CheckoutHead;
  state: BuildState;
  /** The step running, or the step it stopped in; null when none started. */
  step: BuildStep | null;
  cause?: BuildCause;
  /** When it was created, as a history row says it. */
  time: string;
  output: readonly OutputEntry[];
}

const sydney = { kind: "branch", name: publication.branch } as const;
const main = { kind: "branch", name: "main" } as const;
const firna = { kind: "branch", name: "calummoore/firna-controls" } as const;
const protocol = { kind: "branch", name: "calummoore/protocol-docs" } as const;
const rotation = { kind: "branch", name: "alex/token-rotation" } as const;
const bun = { kind: "branch", name: "alex/bun-migration" } as const;
const initialScope = {
  kind: "pull-request",
  number: pullRequest.number,
  title: pullRequest.title,
  author: pullRequest.author,
  github: pullRequest.github,
} as const;
const hosting = { kind: "pull-request", ...buildingPullRequest } as const;
const uploads = { kind: "pull-request", ...closedPullRequest } as const;

/** One checkout head; every branch but the default compares against it. */
function head(sha: string, branch: string): CheckoutHead {
  return { head: sha, branch, compared: branch !== "main" };
}

const heads = {
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

/**
 * One build per card state, on the fixture's own branches and pull requests.
 * Each build has one head, so a SHA that a history row, a switcher row or a
 * publication shows is the same build's everywhere: the published build's is
 * the branch's current publication, and the running builds' are the heads
 * their switcher rows show.
 */
export const builds = {
  /** A newer push on the branch Cal reads, installing now. */
  running: {
    reference: sydney,
    checkout: heads.running,
    state: "running",
    step: "install",
    time: "15 Sep, 16:30",
    output: [...checkoutOutput(heads.running), ...installOutput(false)],
  },
  /** The build that published the branch's current publication. */
  published: {
    reference: sydney,
    checkout: heads.published,
    state: "published",
    step: "publish",
    time: "15 Sep, 14:12",
    output: [
      ...checkoutOutput(heads.published),
      ...elidedInstallOutput(1_412_866),
      ...cliOutput("0.18.0"),
      ...publishedOutput(true),
    ],
  },
  /** A push whose lockfile no longer matched its package manifest. */
  failed: {
    reference: sydney,
    checkout: heads.failed,
    state: "failed",
    step: "install",
    cause: "exit",
    time: "15 Sep, 11:47",
    output: [
      ...checkoutOutput(heads.failed),
      ...lockfileMismatchOutput("2026-09-15T11_48_02_417Z"),
    ],
  },
  /** Alex's pull request, whose publish ran past the attempt deadline. */
  timedOut: {
    reference: initialScope,
    checkout: heads.timedOut,
    state: "timed-out",
    step: "publish",
    cause: "deadline",
    time: "15 Sep, 10:05",
    output: [
      ...checkoutOutput(heads.timedOut),
      ...installOutput(true),
      ...cliOutput("0.18.0"),
      ...publishStoppedOutput(true),
    ],
  },
  /** A push to the default branch GitHub could not serve, five times over. */
  infrastructure: {
    reference: main,
    checkout: heads.infrastructure,
    state: "failed",
    step: "checkout",
    cause: "infrastructure",
    time: "15 Sep, 08:41",
    output: unreachableOutput(heads.infrastructure),
  },
  /** Claimed after the workspace returned to Free, so no step ran. */
  plan: {
    reference: firna,
    checkout: heads.plan,
    state: "failed",
    step: null,
    cause: "plan-required",
    time: "16 Oct, 09:30",
    output: [],
  },
  /** An older branch that still installs the 0.12 CLI. */
  version: {
    reference: protocol,
    checkout: heads.version,
    state: "failed",
    step: "publish",
    cause: "unsupported-mokly-version",
    time: "14 Sep, 17:22",
    output: [
      ...checkoutOutput(heads.version),
      ...installOutput(true),
      ...cliOutput("0.12.0"),
    ],
  },
  /**
   * Alex's branch that moved the repository to Bun: the only lockfile it
   * tracks is `bun.lock`, so the build stops before it installs anything.
   */
  lockfile: {
    reference: bun,
    checkout: heads.lockfile,
    state: "failed",
    step: "install",
    cause: "unsupported-lockfile",
    time: "15 Sep, 12:18",
    output: [...checkoutOutput(heads.lockfile), ...unsupportedLockfileOutput()],
  },
  /** The push the running build replaced while it installed. */
  superseded: {
    reference: sydney,
    checkout: heads.superseded,
    state: "superseded",
    step: "install",
    time: "15 Sep, 16:21",
    output: [...checkoutOutput(heads.superseded), ...installOutput(false)],
  },
  /** Alex's branch, cancelled while it fetched. */
  cancelled: {
    reference: rotation,
    checkout: heads.cancelled,
    state: "cancelled",
    step: "checkout",
    time: "15 Sep, 15:02",
    output: fetchingOutput(heads.cancelled),
  },
  /** The same branch requested again after Alex pushed. */
  queued: {
    reference: rotation,
    checkout: heads.queued,
    state: "queued",
    step: null,
    time: "15 Sep, 15:10",
    output: [],
  },
  /** The default branch's first build, scheduled when the project was created. */
  setup: {
    reference: main,
    checkout: heads.setup,
    state: "running",
    step: "checkout",
    time: "12 Sep, 10:04",
    output: fetchingOutput(heads.setup),
  },
  /** Cal's pull request publishing for the first time; publish prints nothing yet. */
  pullRequest: {
    reference: hosting,
    checkout: heads.pullRequest,
    state: "running",
    step: "publish",
    time: "15 Sep, 16:02",
    output: [
      ...checkoutOutput(heads.pullRequest),
      ...installOutput(true),
      ...cliOutput("0.18.0"),
      ...publishingOutput(true),
    ],
  },
  /**
   * Alex's pull request, whose lockfile no longer matched its manifest. Alex
   * closed it afterwards, so asking for it again is refused.
   */
  closed: {
    reference: uploads,
    checkout: heads.closed,
    state: "failed",
    step: "install",
    cause: "exit",
    time: "14 Sep, 15:36",
    output: [
      ...checkoutOutput(heads.closed),
      ...lockfileMismatchOutput("2026-09-14T15_37_19_806Z"),
    ],
  },
} as const satisfies Record<string, FixtureBuild>;

/** The name of one fixture build. */
export type BuildName = keyof typeof builds;

/** A build's short head SHA, as rows, cards and chrome show it. */
export function shortSha(build: FixtureBuild): string {
  return build.checkout.head.slice(0, 7);
}
