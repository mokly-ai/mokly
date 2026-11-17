import type {
  Build,
  BuildState,
  BuildSummary,
  PublicationSummary,
} from "../api/types";
import type { StatusTone } from "../components/controls";
import type { PublicationRef } from "../data/publications";

import type { stepWords } from "./build-copy";
import { buildSteps } from "./build-copy";
import type { PublicationState } from "./resolution";
import { publicationState, publishedDay } from "./resolution";

/** Whether a build is still waiting or running: what the card polls for. */
export function buildActive(state: BuildState): boolean {
  return state === "queued" || state === "running";
}

/** Whether a build ended with a failure a reader can try again. */
export function buildFailed(state: BuildState): boolean {
  return state === "failed" || state === "timed-out";
}

/** The branch or pull request one build publishes. */
export function buildReference(build: Build): PublicationRef {
  return build.pullRequest
    ? { kind: "pull-request", number: build.pullRequest.number }
    : { kind: "branch", name: build.branch };
}

/** What the chrome and the card call the build's reference. */
export function buildReferenceLabel(build: Build): string {
  return build.pullRequest
    ? "#" + build.pullRequest.number + " " + build.pullRequest.title
    : build.branch;
}

/** How far one step got: the key of the word its column says. */
export type StepProgress = keyof typeof stepWords;

/** One step of a build. */
export type BuildStepId = (typeof buildSteps)[number]["id"];

/** The status tone each step's decorative dot takes. */
export const stepTones = {
  done: "success",
  running: "warning",
  waiting: "neutral",
  failed: "danger",
  stopped: "neutral",
  idle: "neutral",
} as const satisfies Record<StepProgress, StatusTone>;

/**
 * Where one step stands. The steps before the build's own step are done; that
 * step runs while the build runs, failed with a failed build and stopped with
 * a replaced or cancelled one; later steps wait while the build is active and
 * are not run once it ends. A queued build runs nothing yet, so all wait.
 */
export function stepProgress(build: Build, step: BuildStepId): StepProgress {
  if (build.state === "published") return "done";
  if (build.state === "queued") return "waiting";
  const active = buildActive(build.state);
  const at = buildSteps.findIndex(({ id }) => id === build.step);
  const index = buildSteps.findIndex(({ id }) => id === step);
  if (at < 0 || index > at) return active ? "waiting" : "idle";
  if (index < at) return "done";
  if (active) return "running";
  return buildFailed(build.state) ? "failed" : "stopped";
}

/** Whether one instant is later than another, which may be absent. */
function later(at: string, than: string | undefined): boolean {
  return than === undefined || Date.parse(at) > Date.parse(than);
}

/**
 * Whether a reference's newest build failed or timed out after its newest
 * publication attempt was admitted, so the build, not the publication, says
 * what the reference's newest work did.
 */
export function failedAfter(
  build: BuildSummary | null,
  publication: PublicationSummary | null,
): build is BuildSummary {
  return (
    build !== null &&
    buildFailed(build.state) &&
    later(build.createdAt, publication?.publishedAt)
  );
}

/** What a switcher row says, and which attempt it took that from. */
export interface ReferenceRowState {
  state: PublicationState;
  /** The head of whichever attempt the row took its state from. */
  headSha: string | null;
  /** The ready publication's admission time, for the day a row names. */
  publishedAt?: string;
  /** Whether the state came from a build rather than a publication. */
  fromBuild: boolean;
}

/**
 * A row takes its state from the newer of its newest publication and newest
 * build: an active build is publishing, a failed build newer than the newest
 * publication is unable to publish, and otherwise the publication speaks.
 */
export function referenceRowState(
  publication: PublicationSummary | null,
  build: BuildSummary | null,
): ReferenceRowState {
  if (build && buildActive(build.state)) {
    return { state: "publishing", headSha: build.headSha, fromBuild: true };
  }
  if (failedAfter(build, publication)) {
    return { state: "failed", headSha: build.headSha, fromBuild: true };
  }
  if (!publication) return { state: "none", headSha: null, fromBuild: false };
  return {
    state: publicationState(publication),
    headSha: publication.headSha,
    publishedAt: publication.publishedAt,
    fromBuild: false,
  };
}

/**
 * What the publication slot says beside a build's reference: the state its
 * switcher row would read, with no SHA, because a build is not a publication.
 */
export function buildSlot(build: Build): {
  state: PublicationState;
  detail: string;
} {
  if (buildActive(build.state)) {
    return { state: "publishing", detail: "Publishing now" };
  }
  if (build.state === "published") {
    return {
      state: "ready",
      detail: "Published " + publishedDay(build.finishedAt ?? build.createdAt),
    };
  }
  if (buildFailed(build.state)) {
    return { state: "failed", detail: "Unable to publish" };
  }
  return { state: "none", detail: "Not published" };
}
