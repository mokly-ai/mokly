import type { Viewport } from "@mokly/mokly";

import { builds } from "../../../fixtures/builds";
import { members } from "../../../fixtures/product";
import { causes } from "../../../fixtures/product-states";
import { BuildStage } from "./build-stage";
import { StagePublish, StagePublishReader } from "./publish-stage";
import { PullRequestPage } from "./pull-request-page";
import { StandalonePage } from "./standalone-page";

/** Alex's branch, which nothing has published yet. */
const unpublishedBranch = builds.queued.reference.name;

/** A branch with nothing published, in a project that can build. */
export function ViewerStandalonePublishScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish"
      subject={unpublishedBranch}
      stage={<StagePublish reference="branch" />}
    />
  );
}

/**
 * The same branch after Publish this branch was refused while Mokly was busy.
 * The same request can succeed, so the control reads Try again, with the CI
 * setup guide still beside it, above the reference Mokly answered with.
 */
export function ViewerPublishRefusedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish-refused"
      subject={unpublishedBranch}
      stage={
        <StagePublish
          reference="branch"
          refusal={{ cause: causes.busy, retry: true }}
        />
      }
    />
  );
}

/**
 * The same branch after Publish this branch was pressed, while its build
 * request runs: the control reads Publishing… with the busy spinner and
 * leads nowhere until the request answers, and the CI setup guide stays
 * beside it.
 */
export function ViewerPublishBusyScreen({ viewport }: { viewport: Viewport }) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish-busy"
      subject={unpublishedBranch}
      stage={<StagePublish reference="branch" busy />}
    />
  );
}

/**
 * A pull request whose Publish this pull request was refused because the
 * project no longer builds. Pressing it again would be refused again, so the
 * control keeps its own label, and the CI setup guide beside it is the way on.
 */
export function ViewerPublishRefusedPullRequestScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish-refused/pull-request"
      stage={
        <StagePublish
          reference="pull-request"
          refusal={{ cause: causes.buildsUnavailable, retry: false }}
        />
      }
    />
  );
}

/** A pull request with nothing published, at its own alias. */
export function ViewerStandalonePublishPullRequestScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish/pull-request"
      stage={<StagePublish reference="pull-request" />}
    />
  );
}

/** The same branch read by Sam, a reviewer, who waits for it to be published. */
export function ViewerStandalonePublishReaderScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish/reader"
      subject={unpublishedBranch}
      account={{ label: members[2].name }}
      stage={<StagePublishReader reference="branch" />}
    />
  );
}

/** A pull request with nothing published, read by Sam, who waits for it too. */
export function ViewerStandalonePullRequestReaderScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <PullRequestPage
      viewport={viewport}
      state="empty"
      screen="product/viewer/standalone/publish/reader-pull-request"
      account={{ label: members[2].name }}
      stage={<StagePublishReader reference="pull-request" />}
    />
  );
}

/**
 * The default branch of a project just created, whose first build runs: the
 * alias shows that build until its publication is ready.
 */
export function ViewerStandalonePublishingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen="product/viewer/standalone/publish/publishing"
      subject={builds.setup.reference.name}
      publicationMeta={{ state: "publishing", detail: "Publishing now" }}
      stage={<BuildStage build={builds.setup} />}
    />
  );
}
