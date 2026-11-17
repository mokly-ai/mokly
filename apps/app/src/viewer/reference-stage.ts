import type { Branch, PullRequest } from "../api/types";
import { buildActive, failedAfter } from "./build-state";
import { closedState, fromFork } from "./resolution";
import type { ClosedPullRequestState } from "./resolution";

/**
 * The row a reference names: what its own newest attempts did and, for a pull
 * request, whether it is still open and whether it comes from a fork.
 */
export type ReferenceRow = Branch | PullRequest;

/**
 * What a reference with no ready publication shows before any card is chosen:
 * one of its builds, its failed newest publication, or a card. The card names
 * how a pull request closed or that it comes from a fork when either holds;
 * otherwise the plan, the project and the reader choose it.
 */
export type ReferenceStage =
  | { kind: "build"; buildId: string }
  | { kind: "failed-publication"; publicationId: string }
  | {
      kind: "card";
      closed: ClosedPullRequestState | undefined;
      fork: boolean;
    };

/**
 * Choose a reference's stage in the order `viewer-builds.md` gives it. A
 * queued or running build comes first for every plan, because it can still
 * publish, even for a pull request that has closed since. A closed or merged
 * pull request, then one from a fork, is named next for every project and
 * plan. While the plan refuses publishing, the plan's Team card stands for
 * everything else. Then a failed build newer than the newest publication, a
 * failed newest publication, and otherwise the way to publish. A reference
 * with no row is offered the cards its project offers.
 */
export function referenceStage(
  row: ReferenceRow | undefined,
  publishingAllowed: boolean,
): ReferenceStage {
  const build = row?.newestBuild ?? null;
  if (build && buildActive(build.state)) {
    return { kind: "build", buildId: build.id };
  }
  const card: Extract<ReferenceStage, { kind: "card" }> = {
    kind: "card",
    closed: row ? closedState(row) : undefined,
    fork: row ? fromFork(row) : false,
  };
  if (!row || card.closed || card.fork || !publishingAllowed) return card;
  const publication = row.newestPublication;
  if (failedAfter(build, publication)) {
    return { kind: "build", buildId: build.id };
  }
  if (publication?.state === "failed") {
    return { kind: "failed-publication", publicationId: publication.id };
  }
  return card;
}
