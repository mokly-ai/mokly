import type { ApiError } from "../api/errors";
import type { Project, Publication } from "../api/types";
import { Action } from "../components/action";
import { ErrorDetails } from "../components/error-details";
import { StateMessage } from "../components/page-parts";
import { PlanConsequence } from "../components/plan-consequence";
import { site } from "../config";

import { failureRecovery, failureTitle } from "./failure";
import type { ClosedPullRequestState } from "./resolution";
import { StageCard } from "./stage-card";

/** The recovery every stage card offers: the reference the reader can reach. */
export function ChooseAnother({
  onChoose,
  tone = "primary",
}: {
  onChoose: () => void;
  tone?: "primary" | "secondary";
}) {
  return (
    <Action
      label="Choose another branch"
      tone={tone}
      size="md"
      onPress={onChoose}
      testID="stage-choose-publication"
    />
  );
}

/**
 * Nothing is published yet. An administrator is offered the way to publish;
 * everyone else is told who does it, because the action is not theirs. Both are
 * offered the switcher, because another reference may already have one.
 */
export function SetUpPublishing({
  project,
  onChoose,
}: {
  project: Project;
  onChoose: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title="No publications yet"
        icon="branch"
        action={
          <div className="review-inline fo-state-pair">
            {project.canAdmin && (
              <Action
                label="Set up publishing"
                tone="primary"
                size="md"
                icon="external"
                href={site.publishFromCi}
                testID="set-up-publishing"
              />
            )}
            <ChooseAnother
              onChoose={onChoose}
              tone={project.canAdmin ? "secondary" : "primary"}
            />
          </div>
        }
      >
        {project.canAdmin
          ? undefined
          : "An administrator publishes this project."}
      </StateMessage>
    </StageCard>
  );
}

/**
 * A private project on the free plan, which takes no new publication. An owner
 * is offered the way on; everyone else is given the one thing they can do about
 * it. The branch beside it may still hold a publication this project kept, so
 * the switcher stays where every other unpublished stage keeps it.
 */
export function PublishingOnTeam({
  canUpgrade,
  onOpenBilling,
  onChoose,
}: {
  canUpgrade: boolean;
  onOpenBilling: () => void;
  onChoose: () => void;
}) {
  return (
    <StageCard>
      <PlanConsequence
        canUpgrade={canUpgrade}
        onOpenBilling={onOpenBilling}
        tone="primary"
        size="md"
        testID="stage-open-billing"
      >
        {({ action, message }) => (
          <StateMessage
            title="Publishing to private projects is on Team"
            icon="private"
            action={
              <div className="review-inline fo-state-pair">
                {action}
                <ChooseAnother
                  onChoose={onChoose}
                  tone={canUpgrade ? "secondary" : "primary"}
                />
              </div>
            }
          >
            {message}
          </StateMessage>
        )}
      </PlanConsequence>
    </StageCard>
  );
}

/** A pull request whose check has not published a catalogue yet. */
export function UnpublishedPullRequest({ onChoose }: { onChoose: () => void }) {
  return (
    <StageCard>
      <StateMessage
        title="No publication yet"
        icon="pullRequest"
        action={<ChooseAnother onChoose={onChoose} />}
      >
        Publishing starts when this pull request’s check runs.
      </StateMessage>
    </StageCard>
  );
}

/**
 * A pull request that is closed or merged, with nothing published and no build
 * still running. A closed pull request gets no new build, so the card names
 * how it closed and offers the switcher, never a way to publish it.
 */
export function ClosedPullRequest({
  state,
  onChoose,
}: {
  state: ClosedPullRequestState;
  onChoose: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title={
          state === "merged"
            ? "This pull request was merged"
            : "This pull request is closed"
        }
        icon="pullRequest"
        action={<ChooseAnother onChoose={onChoose} />}
      />
    </StageCard>
  );
}

/** An expired, deleted or unreadable publication; the switcher recovers it. */
export function UnavailablePublication({ onChoose }: { onChoose: () => void }) {
  return (
    <StageCard>
      <StateMessage
        title="This publication is unavailable"
        error
        action={<ChooseAnother onChoose={onChoose} />}
      />
    </StageCard>
  );
}

/** A failed attempt opens as its own details, never as an absent catalogue. */
export function FailedPublication({
  publication,
  onChoose,
}: {
  publication: Publication;
  onChoose: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title={failureTitle(publication.branch)}
        error
        action={<ChooseAnother onChoose={onChoose} />}
      >
        {failureRecovery(publication.failureCode)}
      </StateMessage>
    </StageCard>
  );
}

/** The publication host refused the reader's credential; asking again works. */
export function AccessRefused({
  error,
  onRetry,
}: {
  error?: ApiError;
  onRetry: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title="This publication couldn’t open"
        error
        details={
          error ? <ErrorDetails reference={error.requestId} /> : undefined
        }
        action={
          <Action
            label="Try again"
            tone="primary"
            size="md"
            icon="retry"
            onPress={onRetry}
            testID="access-retry"
          />
        }
      />
    </StageCard>
  );
}

/**
 * No credential of the publication's host reaches its screens in this page:
 * the browser keeps the host's cookie out, and the screens cannot open through
 * the embedded route either, because the publication has no start page or its
 * frames report that no access route works. Asking again cannot work, and the
 * catalogue's own tab would hold no credential either. The card is final: it
 * offers no action, and its line sends the reader to a browser on a computer
 * that opens the publication.
 */
export function AccessBlocked() {
  return (
    <StageCard>
      <StateMessage title="This publication can’t open in this browser" error>
        Open it in Chrome, Edge or Firefox on a computer.
      </StateMessage>
    </StageCard>
  );
}

/** A read needed by the stage failed; the reader is offered one retry. */
export function StageError({
  title,
  error,
  onRetry,
}: {
  title: string;
  error: ApiError;
  onRetry: () => void;
}) {
  return (
    <StageCard>
      <StateMessage
        title={title}
        error
        details={<ErrorDetails reference={error.requestId} />}
        action={
          <Action
            label="Try again"
            tone="primary"
            size="md"
            icon="retry"
            onPress={onRetry}
            testID="stage-retry"
          />
        }
      />
    </StageCard>
  );
}
