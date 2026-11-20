import {
  sydney,
  heads,
  initialScope,
  main,
  firna,
  protocol,
  bun,
  rotation,
  hosting,
  uploads,
} from "./build-heads";
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
import type { FixtureBuild } from "./build-types";

/** The three steps every build runs, in order, with the names its card shows. */
export const buildSteps = [
  { id: "checkout", name: "Check out" },
  { id: "install", name: "Install" },
  { id: "publish", name: "Publish" },
] as const;

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
