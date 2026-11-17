import type { Viewport } from "@mokly/mokly";
import type { ReactNode } from "react";

import { pullRequest } from "../../../fixtures/publications";
import { sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import type { AccountLabel } from "./chrome";
import { StageUnpublishedPullRequest } from "./pull-request-stage";
import { ViewerScreen, isPublishedPath } from "./screen";
import type { SlotMeta, SlotPullRequest } from "./slots";
import { PullRequestSlot } from "./slots";
import { stageBody } from "./stage";

const meta = {
  default: {
    state: "ready",
    detail: pullRequest.published,
    sha: pullRequest.sha,
  },
  empty: { state: "none", detail: "Not published" },
  loading: { state: "none", detail: "Loading" },
  error: { state: "failed", detail: "Publication unavailable" },
} as const satisfies Record<ScreenState, SlotMeta>;

/**
 * A pull request entry: the chrome names the pull request and its author, and
 * the stage holds its publication with Changes preselected, or one card.
 */
export function PullRequestPage({
  state,
  viewport,
  pull = pullRequest,
  current = meta[state],
  screen,
  stage,
  account,
}: {
  state: ScreenState;
  viewport: Viewport;
  pull?: SlotPullRequest;
  current?: SlotMeta;
  /** An entry drawing one of the stage's own situations names itself. */
  screen?: string;
  /** A card the stage owns for a situation the four states do not describe. */
  stage?: ReactNode;
  /** Who the bar calls the reader, when it is not Cal. */
  account?: AccountLabel;
}) {
  const title = pull.number + " " + pull.title;
  const body = stage ?? stageBody(state, <StageUnpublishedPullRequest />);
  const shared = {
    id: "product/viewer/pull-request",
    state,
    screen,
    viewport,
    account,
    heading: sample.project + " · " + title,
  };
  if (isPublishedPath(state, body))
    return (
      <ViewerScreen
        {...shared}
        published
        view="changes"
        publishedSubject={{
          label: title,
          detail: pull.author + " · " + current.detail,
          sha: current.sha,
          changes: true,
          github: true,
        }}
      />
    );
  return (
    <ViewerScreen
      {...shared}
      publication={
        <PullRequestSlot viewport={viewport} pull={pull} meta={current} />
      }
    >
      {body}
    </ViewerScreen>
  );
}
