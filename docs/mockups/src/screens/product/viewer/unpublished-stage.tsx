/**
 * The cards of a branch with nothing published: Set up publishing, and the
 * Team card of a private project on the free plan, which a pull request with
 * nothing published shows too. Each has a second form for a reader who
 * cannot take its action, with the switcher as that reader's one control.
 */

import { billing } from "../../../fixtures/product-states";
import { Action, StateMessage } from "../page-parts";
import { StageCard } from "./stage-card";

/**
 * A branch with nothing published. Administrators set publishing up; everyone
 * else is told an administrator publishes this project and offered the
 * switcher, which the second action already is.
 */
export function StageUnpublished() {
  return (
    <StageCard>
      <StateMessage
        title="No publications yet"
        icon="branch"
        action={
          <div className="review-inline fo-state-pair">
            <Action
              instance="stage-set-up-publishing"
              label="Set up publishing"
              to="product/account/project-created/empty"
              tone="primary"
              size="md"
              icon="external"
            />
            <Action
              instance="stage-choose-publication"
              label="Choose another branch"
              to="product/viewer/switcher"
              tone="secondary"
              size="md"
            />
          </div>
        }
      />
    </StageCard>
  );
}

/**
 * The same branch read by someone who cannot publish it. Setting publishing up
 * is not their action, so the card names who does it and offers the switcher
 * instead of a control they would not be allowed to press.
 */
export function StageUnpublishedReader() {
  return (
    <StageCard>
      <StateMessage
        title="No publications yet"
        icon="branch"
        action={
          <Action
            instance="stage-reader-choose-publication"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      >
        An administrator publishes this project.
      </StateMessage>
    </StageCard>
  );
}

/**
 * A private project on the free plan, which takes no new publication. An owner
 * is offered the way on; the branch beside it may still hold one this project
 * kept, so the switcher stays where every other unpublished stage keeps it.
 */
export function StagePlanRequired() {
  return (
    <StageCard>
      <StateMessage
        title="Publishing to private projects is on Team"
        icon="private"
        action={
          <div className="review-inline fo-state-pair">
            <Action
              instance="stage-open-billing"
              label="Open billing"
              to="product/settings/billing"
              tone="primary"
              size="md"
            />
            <Action
              instance="stage-plan-choose-publication"
              label="Choose another branch"
              to="product/viewer/switcher"
              tone="secondary"
              size="md"
            />
          </div>
        }
      />
    </StageCard>
  );
}

/**
 * The same project read by someone who cannot start Checkout. Opening billing
 * is not their action, so the card says what they can do instead and offers
 * the switcher, exactly as the unpublished branch does for a reader.
 */
export function StagePlanRequiredReader() {
  return (
    <StageCard>
      <StateMessage
        title="Publishing to private projects is on Team"
        icon="private"
        action={
          <Action
            instance="stage-plan-reader-choose-publication"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      >
        {billing.copy.askOwner}
      </StateMessage>
    </StageCard>
  );
}
