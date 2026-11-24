import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";

import type { FixtureBuild } from "../../../fixtures/build-types";
import { builds } from "../../../fixtures/builds";
import { publication } from "../../../fixtures/publications";

import type { AccountLabel } from "./account-trigger";
import type { BuildReader } from "./build-card";
import type { BuildPress } from "./build-controls";
import {
  BuildPending,
  BuildStage,
  BuildUnavailable,
  BuildUnreadable,
} from "./build-stage";
import { readyDetail } from "./pill";
import { PullRequestPage } from "./pull-request-page";
import type { SlotMeta } from "./slots";
import { StandalonePage } from "./standalone-page";

/**
 * What the publication slot says about a build: the state its switcher row
 * would read, with no publication SHA, because a build is not a publication.
 */
function buildMeta(build: FixtureBuild): SlotMeta {
  switch (build.state) {
    case "queued":
    case "running":
      return { state: "publishing", detail: "Publishing now" };
    case "published":
      return { state: "ready", detail: readyDetail(publication.published) };
    case "failed":
    case "timed-out":
      return { state: "failed", detail: "Unable to publish" };
    case "superseded":
    case "cancelled":
      return { state: "none", detail: "Not published" };
  }
}

/**
 * One build's details in the viewer: the chrome names the build's branch or
 * pull request, and the stage holds the build's card instead of a catalogue.
 * A pressed Try again or Cancel shows the refusal it was answered with, or
 * its busy state while its request runs.
 */
export function BuildPage({
  viewport,
  screen,
  build,
  reader,
  account,
  ...press
}: {
  viewport: Viewport;
  screen: string;
  build: FixtureBuild;
  /** Who reads the card, when its body depends on someone other than Cal. */
  reader?: BuildReader;
  /** Who the bar calls the reader, when it is not Cal. */
  account?: AccountLabel;
} & BuildPress) {
  const stage: ReactNode = (
    <BuildStage build={build} reader={reader} {...press} />
  );
  const reference = build.reference;
  return reference.kind === "branch" ? (
    <StandalonePage
      viewport={viewport}
      state="default"
      screen={screen}
      subject={reference.name}
      publicationMeta={buildMeta(build)}
      account={account}
      stage={stage}
    />
  ) : (
    <PullRequestPage
      viewport={viewport}
      state="default"
      screen={screen}
      pull={reference}
      current={buildMeta(build)}
      account={account}
      stage={stage}
    />
  );
}

/** A build running on a newer push of the branch Cal reads. */
export function ViewerBuildScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build"
      build={builds.running}
    />
  );
}

/** A requested build waiting for a worker, with nothing to show yet. */
export function ViewerBuildEmptyScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/empty"
      build={builds.queued}
    />
  );
}

/** The build address while the build is read; nothing names its branch yet. */
export function ViewerBuildLoadingScreen({ viewport }: { viewport: Viewport }) {
  return (
    <StandalonePage
      viewport={viewport}
      state="loading"
      screen="product/viewer/standalone/build/loading"
      subject="This build"
      reference="This build"
      stage={<BuildPending />}
    />
  );
}

/** A build address that names nothing this reader can open. */
export function ViewerBuildErrorScreen({ viewport }: { viewport: Viewport }) {
  return (
    <StandalonePage
      viewport={viewport}
      state="error"
      screen="product/viewer/standalone/build/error"
      subject="This build"
      reference="This build"
      publicationMeta={{ state: "failed", detail: "Build unavailable" }}
      stage={<BuildUnavailable />}
    />
  );
}

/**
 * A build address whose first read failed for another reason than the build
 * being absent. Nothing names its branch yet, so the slot keeps This build.
 */
export function ViewerBuildUnreadableScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <StandalonePage
      viewport={viewport}
      state="error"
      screen="product/viewer/standalone/build/unreadable"
      subject="This build"
      reference="This build"
      publicationMeta={{ state: "failed", detail: "Build couldn’t load" }}
      stage={<BuildUnreadable />}
    />
  );
}

/** The build that published the branch's current publication. */
export function ViewerBuildPublishedScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/published"
      build={builds.published}
    />
  );
}

/** A build whose install failed, with the output's tail. */
export function ViewerBuildFailedScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/failed"
      build={builds.failed}
    />
  );
}

/** A pull request build that ran past its attempt deadline. */
export function ViewerBuildTimedOutScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/failed/timed-out"
      build={builds.timedOut}
    />
  );
}

/** A build Mokly could not run, after every retry. */
export function ViewerBuildInfrastructureScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/failed/infrastructure"
      build={builds.infrastructure}
    />
  );
}

/** A build the workspace's plan refused, read by its owner. */
export function ViewerBuildPlanScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/failed/plan"
      build={builds.plan}
    />
  );
}

/** A build whose repository installs a CLI older than builds accept. */
export function ViewerBuildVersionScreen({ viewport }: { viewport: Viewport }) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/failed/version"
      build={builds.version}
    />
  );
}

/**
 * A build whose nearest lockfile belongs to a package manager builds do not
 * run, so it stopped before installing and points at publishing from CI.
 */
export function ViewerBuildLockfileScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/lockfile"
      build={builds.lockfile}
    />
  );
}

/** A build a newer push on the same branch replaced. */
export function ViewerBuildSupersededScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/superseded"
      build={builds.superseded}
    />
  );
}

/** A build a project member cancelled. */
export function ViewerBuildCancelledScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return (
    <BuildPage
      viewport={viewport}
      screen="product/viewer/standalone/build/superseded/cancelled"
      build={builds.cancelled}
    />
  );
}
