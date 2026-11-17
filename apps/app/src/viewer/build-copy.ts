import { askAnOwnerToUpgrade } from "../api/labels";
import type { Build, BuildFailure } from "../api/types";
import type { PublicationRef } from "../data/publications";
import type { WorkspaceRole } from "./workspace-role";

/**
 * Every sentence and label the build card, the build address's stage and the
 * publishing card draw themselves, in the words of
 * `docs/protocol/cloud/viewer-builds.md` and, for the build address's stage,
 * `docs/protocol/cloud/viewer-build-navigation.md`. The controls they share keep
 * their own owners: the switcher, the stage's retry, Open billing and the way
 * back after a refusal. Step names, commands and exit codes stay in the output
 * and the check; what the card says is the reader's half of what happened.
 */

/** One way a failed or timed-out build ended. */
export type BuildCause = BuildFailure["cause"];

/**
 * The sentence each failure cause chooses, keyed as the contract's cause table
 * names its rows. `plan-required` is absent because it titles the card
 * instead: the plan, not the build, is what the reader can act on.
 */
export const causeSentences = {
  "exit at install": "Installing dependencies failed.",
  "exit at publish": "The catalogue couldn’t be built.",
  "upload-rejected": "Mokly couldn’t accept this catalogue.",
  "unsupported-lockfile": "Mokly installs with npm, pnpm or Yarn.",
  "unsupported-mokly-version":
    "Update `@mokly/mokly` to 0.18.0 or later to publish.",
  "uncommitted-changes":
    "The build left files that Git doesn’t ignore; add them to .gitignore.",
  "output-limit": "The build printed too much output; print less to publish.",
  deadline: "The build stopped at its 15-minute limit.",
  idle: "The build stopped after going quiet.",
  infrastructure: "Mokly couldn’t run this build.",
  "repository-unavailable":
    "Mokly can’t reach this repository; check the GitHub installation.",
} as const;

/** The sentence one failure says, or none for the plan's own card. */
export function causeSentence(failure: BuildFailure): string | undefined {
  if (failure.cause === "plan-required") return undefined;
  if (failure.cause === "exit") {
    return failure.step === "install"
      ? causeSentences["exit at install"]
      : causeSentences["exit at publish"];
  }
  return causeSentences[failure.cause];
}

/** Whether a build publishes a pull request rather than a branch. */
function forPullRequest(build: Build): boolean {
  return build.pullRequest !== null;
}

/**
 * The card's title, one per build state. A plan refusal takes the Team card's
 * own title, because the workspace's plan is what stopped it.
 */
export function buildTitle(build: Build): string {
  if (build.failure?.cause === "plan-required") {
    return "Publishing to private projects is on Team";
  }
  const pull = forPullRequest(build);
  switch (build.state) {
    case "queued":
    case "running":
      return pull ? "Publishing this pull request" : "Publishing this branch";
    case "published":
      return pull ? "Published this pull request" : "Published this branch";
    case "failed":
    case "timed-out":
      return pull
        ? "Unable to publish this pull request"
        : "Unable to publish this branch";
    case "superseded":
      return "A newer push replaced this build";
    case "cancelled":
      return "Publishing was cancelled";
  }
}

/**
 * The line beneath a build card's title, by what it says: that a queued build
 * waits to start, why a failed or timed-out build ended, or who can upgrade
 * the plan that refused it. The drawing test keys the card's bodies by this
 * kind, so a kind added here has no drawing there until it names one.
 */
export type BuildLine =
  | { kind: "waiting"; text: string }
  | { kind: "cause"; text: string }
  | { kind: "plan"; text: string };

/**
 * The line beneath the title: why the build ended, or that it waits. A plan
 * refusal asks an owner only once the workspace-role rule says the reader
 * is not one, so an owner is never briefly told to ask somebody else.
 */
export function buildLine(
  build: Build,
  role: WorkspaceRole,
): BuildLine | undefined {
  if (build.state === "queued") {
    return { kind: "waiting", text: "Waiting to start." };
  }
  if (build.state !== "failed" && build.state !== "timed-out") return undefined;
  const failure = build.failure;
  if (!failure) return undefined;
  if (failure.cause === "plan-required") {
    return role.kind === "not-owner"
      ? { kind: "plan", text: askAnOwnerToUpgrade }
      : undefined;
  }
  const text = causeSentence(failure);
  return text === undefined ? undefined : { kind: "cause", text };
}

/**
 * What the build card's own controls read: Cancel at rest and while it runs,
 * and Try again, Open catalogue and Open the newer build at rest. Open
 * billing is the shared role rule's control, and the two labels below are
 * shared with the publishing card.
 */
export const buildCardLabels = {
  cancel: "Cancel",
  cancelling: "Cancelling…",
  tryAgain: "Try again",
  openCatalogue: "Open catalogue",
  openNewer: "Open the newer build",
} as const;

/**
 * What a control that requests a build reads while its request runs: Try
 * again on a build card and Publish on the publishing card alike.
 */
export const publishingLabel = "Publishing…";

/**
 * The operation a screen reader hears while a build request runs, by the
 * reference the request publishes: the control shows `publishingLabel`, and
 * the build it starts takes the same words as its title.
 */
export const publishingOperation = {
  branch: "Publishing this branch",
  "pull-request": "Publishing this pull request",
} as const satisfies Record<PublicationRef["kind"], string>;

/**
 * The operation a screen reader hears while Cancel's request runs, beside
 * its working word, `buildCardLabels.cancelling`.
 */
export const cancellingOperation = "Cancelling this build";

/**
 * The link to the CI setup guide that the build card and the publishing card
 * both offer.
 */
export const publishFromCiLabel = "Publish from CI";

/** How far one step got, as the word beneath its name says it. */
export const stepWords = {
  done: "Done",
  running: "Running",
  waiting: "Waiting",
  failed: "Failed",
  stopped: "Stopped",
  idle: "Not run",
} as const;

/** The three steps every build runs, in order, with the names its card shows. */
export const buildSteps = [
  { id: "checkout", name: "Check out" },
  { id: "install", name: "Install" },
  { id: "publish", name: "Publish" },
] as const;

/**
 * The line the output draws where retained output was dropped: the size in KB
 * or MB to one decimal place, at 1,000 bytes to the KB.
 */
export function elisionText(bytes: number): string {
  const size =
    bytes >= 1_000_000
      ? (bytes / 1_000_000).toFixed(1) + " MB"
      : (bytes / 1_000).toFixed(1) + " KB";
  return size + " of output not kept";
}

/**
 * What the build address's stage says before it has a card to show: while it
 * reads the build, and when that read finds no build or fails. `Pending` adds
 * the loading label's ellipsis.
 */
export const buildStageCopy = {
  loading: "Loading build",
  unavailable: "This build is unavailable",
  unreadable: "This build couldn’t load",
} as const;

/**
 * What the publishing card says for a branch and for a pull request: its
 * title, the control that publishes the reference, and the line a reviewer
 * who cannot publish reads instead.
 */
export const publishCardCopy = {
  branch: {
    title: "No publications yet",
    publish: "Publish this branch",
    askToPublish: "Ask a member or administrator to publish this branch.",
  },
  pullRequest: {
    title: "No publication yet",
    publish: "Publish this pull request",
    askToPublish: "Ask a member or administrator to publish this pull request.",
  },
} as const;
