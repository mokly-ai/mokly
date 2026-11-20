import type { ReactNode } from "react";

import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { failureRecovery } from "../../../fixtures/publications";
import { Action, StateMessage } from "../page-parts";

import { StageCard, StageWait } from "./stage-card";

/** An expired, deleted or unreadable publication; the switcher recovers it. */
function StageUnavailable() {
  return (
    <StageCard>
      <StateMessage
        title="This publication is unavailable"
        error
        reference={failureReference}
        action={
          <Action
            instance="stage-recover"
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
 * A failed attempt opens as its own details, never as an absent catalogue: the
 * branch that could not be published, and the one thing the reader can do about
 * it, chosen from the classification Mokly kept.
 */
export function StageFailed() {
  return (
    <StageCard>
      <StateMessage
        title="Unable to publish this branch"
        error
        action={
          <Action
            instance="stage-failed-choose-publication"
            label="Choose another branch"
            to="product/viewer/switcher"
            tone="primary"
            size="md"
          />
        }
      >
        {failureRecovery}
      </StateMessage>
    </StageCard>
  );
}

/**
 * The publication itself could not be read. Unlike an expired or deleted one,
 * the reader is not being told the publication is gone — only that asking for
 * it failed, so the one thing on offer is asking again.
 */
export function StageUnreadable() {
  return (
    <StageCard>
      <StateMessage
        title="This publication couldn’t load"
        error
        reference={failureReference}
        action={
          <Action
            instance="stage-retry"
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
 * The workspace ownership read that decides whether this reader can open
 * Billing failed. The project and its publishing capability already resolved,
 * so the card names the workspace and offers that read again.
 */
export function StageWorkspaceUnreadable() {
  return (
    <StageCard>
      <StateMessage
        title="This workspace couldn’t load"
        error
        reference={failureReference}
        action={
          <Action
            instance="stage-retry"
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

/** The fallback body for one non-ready screen state. */
export function stageBody(state: ScreenState, unpublished: ReactNode) {
  if (state === "loading") return <StageWait label="Loading publication" />;
  if (state === "error") return <StageUnavailable />;
  if (state === "empty") return unpublished;
  return undefined;
}
