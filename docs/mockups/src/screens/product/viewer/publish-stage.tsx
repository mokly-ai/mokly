import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import { requestOperations } from "../../../fixtures/build-copy";
import { failureReference } from "../../../fixtures/product-states";
import { site } from "../../../fixtures/site";
import { Action, ExternalLink, StateMessage } from "../page-parts";
import { ControlWithGuide } from "./control-guide";
import { StageCard } from "./stage-card";

/** A publish request the API refused, as the card reports it. */
export interface PublishRefusal {
  /** What the refusal says, immediately above the control. */
  cause: string;
  /**
   * Whether the same request could succeed, so the control reads the way
   * back, Try again; otherwise it keeps its own label and leads nowhere new.
   */
  retry: boolean;
}

/**
 * What the card's control shows after a press: the refusal its request was
 * answered with, or, while the request runs, its Write in progress. A control
 * nobody pressed is at rest.
 */
type PublishPress =
  | { refusal?: PublishRefusal; busy?: undefined }
  | { refusal?: undefined; busy: true };

/**
 * What the control reads: Publishing… while its request runs, the way back
 * after a refusal the same request could get past, and its own label
 * otherwise.
 */
function publishLabel(branch: boolean, { refusal, busy }: PublishPress) {
  if (busy) return "Publishing…";
  if (refusal?.retry) return "Try again";
  return branch ? "Publish this branch" : "Publish this pull request";
}

/**
 * A reference with nothing published, read by someone who can publish it in a
 * project that can build: one press starts the build that publishes it, and
 * the CI setup guide stays beside it as the other way. Both are one control
 * with its guide; a refused request puts that fragment between the refusal
 * and the reference Mokly answered with, so the guide stays above Details.
 * While the request runs, the control is busy and the guide stays beside it.
 */
export function StagePublish({
  reference,
  ...press
}: {
  reference: "branch" | "pull-request";
} & PublishPress) {
  const { refusal, busy } = press;
  const branch = reference === "branch";
  const again = refusal === undefined || refusal.retry;
  const fragment = (
    <ControlWithGuide
      control={
        <Action
          instance="stage-publish"
          label={publishLabel(branch, press)}
          to={again ? "product/viewer/standalone/build/empty" : undefined}
          tone="primary"
          size="md"
          busy={busy ? requestOperations[reference] : undefined}
        />
      }
      guide={<ExternalLink to={site.publishFromCi} label="Publish from CI" />}
    />
  );
  return (
    <StageCard>
      <StateMessage
        title={branch ? "No publications yet" : "No publication yet"}
        icon={branch ? "branch" : "pullRequest"}
        action={
          refusal ? (
            <WriteFailure
              moklyInstance="stage-publish-refusal"
              cause={refusal.cause}
              reference={failureReference}
              control={fragment}
            />
          ) : (
            fragment
          )
        }
      />
    </StageCard>
  );
}

/**
 * The same reference read by a reviewer, who cannot request a build: the card
 * says who can and offers the switcher instead of a control they lack.
 */
export function StagePublishReader({
  reference,
}: {
  reference: "branch" | "pull-request";
}) {
  const branch = reference === "branch";
  return (
    <StageCard>
      <StateMessage
        title={branch ? "No publications yet" : "No publication yet"}
        icon={branch ? "branch" : "pullRequest"}
        action={
          <Action
            instance="stage-publish-reader-choose"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      >
        {branch
          ? "Ask a member or administrator to publish this branch."
          : "Ask a member or administrator to publish this pull request."}
      </StateMessage>
    </StageCard>
  );
}
