import type { ReactNode } from "react";

import type { FixtureBuild } from "../../../fixtures/build-types";
import { failureReference } from "../../../fixtures/product-states";
import { site } from "../../../fixtures/site";
import { Action, ExternalLink, Pending, StateMessage } from "../page-parts";
import { ControlPlaceholder } from "../placeholders";

import { BuildCard, ownerReader } from "./build-card";
import type { BuildReader } from "./build-card";
import { CancelBuild, TryAgain } from "./build-controls";
import type { BuildPress } from "./build-controls";
import { StageCard, StageWait } from "./stage-card";

/** The width of Open billing at the card's action size, in px. */
const openBillingWidth = 110;

/**
 * The owner's action while the workspace read decides who the reader is: its
 * placeholder in the action's own place, because an owner, the most common
 * reader, is offered Open billing. The owner's card has no line, and no text
 * place on it is the read's, so the read is named for screen readers only.
 */
function OwnerActionWait() {
  return (
    <Pending label="Checking publishing access" labelMode="screen-reader-only">
      <ControlPlaceholder size="md" width={openBillingWidth} />
    </Pending>
  );
}

/**
 * The one action a build's card offers its reader, or none. Only a reader who
 * may cancel builds is offered Cancel; every other action is the way on. A
 * lockfile builds cannot install is answered by the CI setup guide, a link
 * like every other Publish from CI, because the same request would fail
 * again. Open billing is an owner's, and nobody is offered it while the
 * workspace read decides who the reader is: that read draws the owner's
 * action as a placeholder. Try again needs a reader who can request builds.
 * A request the API refused says why through the write-failure fragment,
 * beside the control that sent it, and a request that runs holds that
 * control busy.
 */
function buildAction(
  build: FixtureBuild,
  reader: BuildReader,
  press: BuildPress,
): ReactNode {
  if (build.state === "queued" || build.state === "running")
    return reader.canCancel ? <CancelBuild {...press} /> : undefined;
  if (build.state === "published")
    return (
      <Action
        instance="build-open-catalogue"
        label="Open catalogue"
        to="product/viewer/standalone"
        tone="primary"
        size="md"
      />
    );
  if (build.state === "superseded")
    return (
      <Action
        instance="build-open-newer"
        label="Open the newer build"
        to="product/viewer/standalone/build"
        tone="primary"
        size="md"
      />
    );
  if (build.cause === "plan-required") {
    if (reader.role === "pending") return <OwnerActionWait />;
    return reader.role === "owner" ? (
      <Action
        instance="build-open-billing"
        label="Open billing"
        to="product/settings/billing"
        tone="primary"
        size="md"
      />
    ) : undefined;
  }
  if (build.cause === "unsupported-lockfile")
    return <ExternalLink to={site.publishFromCi} label="Publish from CI" />;
  if (!reader.canRequestBuilds) return undefined;
  return <TryAgain {...press} reference={build.reference.kind} />;
}

/**
 * One build's card in the stage, at its own address or at its reference's,
 * for one reader, with the refusal its control's request was answered with
 * when it was refused, or with that control busy while its request runs.
 */
export function BuildStage({
  build,
  reader = ownerReader,
  ...press
}: {
  build: FixtureBuild;
  reader?: BuildReader;
} & BuildPress) {
  return (
    <StageCard>
      <BuildCard
        build={build}
        reader={reader}
        action={buildAction(build, reader, press)}
      />
    </StageCard>
  );
}

/**
 * The build is still being read: the chrome stays and the stage's waiting card
 * names the read in its title.
 */
export function BuildPending() {
  return <StageWait label="Loading build" />;
}

/**
 * The build read failed for a reason other than the build being absent. The
 * reader is not told the build is gone, only that reading it failed, so the
 * one thing on offer is reading it again, exactly as for a publication.
 */
export function BuildUnreadable() {
  return (
    <StageCard>
      <StateMessage
        title="This build couldn’t load"
        error
        reference={failureReference}
        action={
          <Action
            instance="build-retry"
            label="Try again"
            tone="primary"
            size="md"
            icon="retry"
          />
        }
      />
    </StageCard>
  );
}

/**
 * An unknown build, one on another project or one this reader may not see. The
 * switcher is the way on, exactly as for an unavailable publication.
 */
export function BuildUnavailable() {
  return (
    <StageCard>
      <StateMessage
        title="This build is unavailable"
        error
        reference={failureReference}
        action={
          <Action
            instance="build-choose-publication"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      />
    </StageCard>
  );
}
