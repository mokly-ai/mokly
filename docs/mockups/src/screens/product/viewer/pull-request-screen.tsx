import type { Viewport } from "@mokly/mokly";

import { builds } from "../../../fixtures/builds";
import { members } from "../../../fixtures/product";
import {
  buildingPullRequest,
  closedPullRequest,
  forkPullRequest,
} from "../../../fixtures/publications";
import { BuildStage } from "./build-stage";
import { PullRequestPage } from "./pull-request-page";
import {
  StageClosedPullRequest,
  StageForkPullRequest,
} from "./pull-request-stage";
import {
  StagePlanRequired,
  StagePlanRequiredReader,
} from "./unpublished-stage";

export function ViewerPullRequestScreen({ viewport }: { viewport: Viewport }) {
  return <PullRequestPage viewport={viewport} state="default" />;
}

export function ViewerPullRequestEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <PullRequestPage viewport={viewport} state="empty" />;
}

export function ViewerPullRequestLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <PullRequestPage viewport={viewport} state="loading" />;
}

export function ViewerPullRequestErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <PullRequestPage viewport={viewport} state="error" />;
}

/**
 * A pull request with nothing ready whose first build runs: its alias shows
 * that build in the stage, and resolves to the publication once it is ready.
 */
export function ViewerPullRequestPublishingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="default"
      screen="product/viewer/pull-request/publishing"
      pull={buildingPullRequest}
      current={{ state: "publishing", detail: "Publishing now" }}
      stage={<BuildStage build={builds.pullRequest} />}
    />
  );
}

/**
 * Alex's pull request, closed with nothing published. Its alias names the
 * state in the stage and offers the switcher, never a way to publish it.
 */
export function ViewerPullRequestClosedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/pull-request/closed"
      pull={closedPullRequest}
      stage={<StageClosedPullRequest />}
    />
  );
}

/** Sam's pull request from a fork, merged with nothing published. */
export function ViewerPullRequestMergedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/pull-request/closed/merged"
      pull={forkPullRequest}
      stage={<StageClosedPullRequest merged />}
    />
  );
}

/**
 * Sam's pull request from a fork, open with nothing published. Builds never
 * run for a fork, so its alias names that and offers the switcher.
 */
export function ViewerPullRequestForkScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/pull-request/fork"
      pull={forkPullRequest}
      stage={<StageForkPullRequest />}
    />
  );
}

/**
 * Alex's open pull request in a private project on the free plan, with
 * nothing published, read by Cal, an owner. The plan takes no new
 * publication, so the alias shows the Team card a branch shows: Open billing,
 * with the switcher beside it.
 */
export function ViewerPullRequestPlanScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/pull-request/plan"
      stage={<StagePlanRequired />}
    />
  );
}

/**
 * The same pull request read by Sam, who is not an owner: the card says what
 * they can do instead and offers the switcher.
 */
export function ViewerPullRequestPlanReaderScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/pull-request/plan/reader"
      account={{ label: members[2].name }}
      stage={<StagePlanRequiredReader />}
    />
  );
}
