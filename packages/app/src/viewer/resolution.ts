import type { Branch, Publication, PullRequest } from "../api/types";
import type { PublicationRef } from "../data/publications";

import type { ViewerStatus } from "./host";

/** How a reference or a history row reads: what its newest attempt did. */
export type PublicationState = "ready" | "publishing" | "failed" | "none";

/** The status tone each publication state takes in a row's decorative dot. */
export const publicationTones = {
  ready: "success",
  publishing: "warning",
  failed: "danger",
  none: "neutral",
} as const;

/**
 * What one publication's lifecycle state means to a reader. A reference row's
 * newest attempt carries the same lifecycle field as the publication itself, so
 * one reading serves the chrome, history and the switcher alike.
 */
export function publicationState(publication: {
  state: Publication["state"];
}): PublicationState {
  if (publication.state === "ready") return "ready";
  if (publication.state === "failed") return "failed";
  if (publication.state === "expired") return "none";
  return "publishing";
}

/**
 * What the stage can do with the publication the route resolved. Only a ready,
 * unexpired publication carries a catalogue; an attempt still being admitted is
 * a named pending operation, and everything else is unavailable, so the stage
 * never claims a catalogue that is not there.
 */
export function stageStatus(publication: Publication): ViewerStatus {
  if (publication.state === "ready" && publication.catalogueUrl) return "ready";
  if (publication.state === "uploading" || publication.state === "validating") {
    return "loading";
  }
  return "unavailable";
}

/** The seven characters of a head SHA a reader recognizes it by. */
export function shortSha(sha: string | null): string | undefined {
  return sha ? sha.slice(0, 7) : undefined;
}

const dayFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
});

const momentFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** The day a publication was admitted, for a switcher row's one line. */
export function publishedDay(at: string): string {
  return dayFormat.format(new Date(at));
}

/** The minute a publication was admitted, for one history row. */
export function publishedMoment(at: string): string {
  return momentFormat.format(new Date(at));
}

/** The newest attempt on one branch, whatever it did, or nothing. */
export function newestForBranch(
  publications: readonly Publication[],
  branch: string,
): Publication | undefined {
  return publications.find((entry) => entry.branch === branch);
}

/** One publication out of a page the viewer already read. */
export function byId(
  publications: readonly Publication[],
  id: string | null,
): Publication | undefined {
  return id === null
    ? undefined
    : publications.find((entry) => entry.id === id);
}

/**
 * The publication standalone entry opens. The project's default branch is
 * first, so its newest ready publication is the one the reader expects; when it
 * has none, the newest ready publication on any other reference is opened
 * rather than sending a reader with published work to Set up publishing.
 *
 * "Newest" is the reference whose own work is most recent, not the first by
 * name: a project whose default branch has never published should land the
 * reader on what was published this morning.
 */
export function standalonePublication(
  branches: readonly Branch[],
): string | undefined {
  const [preferred, ...rest] = branches;
  if (preferred?.latestPublicationId) return preferred.latestPublicationId;
  let newest: Branch | undefined;
  for (const branch of rest) {
    if (!branch.latestPublicationId) continue;
    if (newest === undefined || branch.updatedAt > newest.updatedAt) {
      newest = branch;
    }
  }
  return newest?.latestPublicationId ?? undefined;
}

/**
 * How a pull request closed: without merging, or merged. An open pull request
 * has not closed, and a branch never closes.
 */
export type ClosedPullRequestState = Extract<
  PullRequest["state"],
  "closed" | "merged"
>;

/**
 * How a reference's own row says its pull request closed, if it has. A closed
 * pull request gets no new build, so once no build of it is still queued or
 * running, the stage names how it closed in place of every way to publish it.
 * A branch row carries no state.
 */
export function closedState(
  row: Branch | PullRequest,
): ClosedPullRequestState | undefined {
  if (!("state" in row)) return undefined;
  return row.state === "closed" || row.state === "merged"
    ? row.state
    : undefined;
}

/**
 * Whether a reference's own row says its pull request comes from a fork. No
 * build ever runs for one, so the stage names the fact in place of every way
 * to publish it. A branch row carries no such fact.
 */
export function fromFork(row: Branch | PullRequest): boolean {
  return "fork" in row && row.fork;
}

/** What the chrome calls the reference the reader is inside. */
export function refLabel(ref: PublicationRef): string {
  return ref.kind === "branch" ? ref.name : "#" + ref.number;
}

/**
 * The reference one publication belongs to, so a publication opened by its own
 * link still names the branch that produced it in the chrome and in history.
 */
export function refOf(publication: Publication): PublicationRef | undefined {
  return publication.branch
    ? { kind: "branch", name: publication.branch }
    : undefined;
}
