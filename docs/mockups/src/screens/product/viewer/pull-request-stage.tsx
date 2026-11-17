/**
 * The cards a pull request alias with nothing published shows when no build
 * card or publishing card applies: the pull request whose check has not run,
 * the pull request that is closed or merged, and the pull request from a
 * fork.
 */

import { Action, StateMessage } from "../page-parts";

import { StageCard } from "./stage-card";

/** A pull request whose check has not published a catalogue yet. */
export function StageUnpublishedPullRequest() {
  return (
    <StageCard>
      <StateMessage
        title="No publication yet"
        icon="pullRequest"
        action={
          <Action
            instance="stage-choose-publication"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      >
        Publishing starts when this pull request’s check runs.
      </StateMessage>
    </StageCard>
  );
}

/**
 * A pull request that is closed or merged, with nothing published. A closed
 * pull request gets no new build, so the card names its state and offers the
 * switcher, never a way to publish it.
 */
export function StageClosedPullRequest({
  merged = false,
}: {
  merged?: boolean;
}) {
  return (
    <StageCard>
      <StateMessage
        title={
          merged
            ? "This pull request was merged"
            : "This pull request is closed"
        }
        icon="pullRequest"
        action={
          <Action
            instance="stage-closed-choose-publication"
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

/**
 * An open pull request from a fork, with nothing published. Builds never run
 * for a fork, so the card names the fact, says what the reader can do instead
 * and offers the switcher, with no way to publish it, no one to ask and no CI
 * guide.
 */
export function StageForkPullRequest() {
  return (
    <StageCard>
      <StateMessage
        title="This pull request is from a fork"
        icon="pullRequest"
        action={
          <Action
            instance="stage-fork-choose-publication"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      >
        Review this pull request’s screens locally.
      </StateMessage>
    </StageCard>
  );
}
