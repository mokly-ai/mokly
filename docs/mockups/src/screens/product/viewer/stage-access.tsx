import type { ReactNode } from "react";

import { failureReference } from "../../../fixtures/product-states";
import { Action, StateMessage } from "../page-parts";

import { StageCard, StageWait } from "./stage-card";

/**
 * The three answers the publication's own host can give before its catalogue
 * mounts. A ready publication is still behind the host's own credential, so
 * the stage says where the reader stands while the chrome stays.
 */

/**
 * A private catalogue is served by its own host, which needs its own
 * credential: the API issues a one-use grant and that host exchanges it for a
 * cookie before the stage mounts anything. The catalogue's index read that
 * follows shows the same card.
 */
export function StageOpening() {
  return <StageWait label="Opening the catalogue" />;
}

/** The host refused the reader's credential; asking again is worth a press. */
export function StageAccessRefused() {
  return (
    <StageCard>
      <StateMessage
        title="This publication couldn’t open"
        error
        reference={failureReference}
        action={
          <Action
            instance="stage-access-retry"
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
 * The browser keeps the publication host's cookie out of this page, so asking
 * again cannot work. The server-rendered catalogue is offered where document
 * navigation can use that credential: its own first-party tab.
 */
export function StageAccessBlocked({ action }: { action?: ReactNode } = {}) {
  return (
    <StageCard>
      <StateMessage
        title="Open the catalogue in its own tab"
        error
        action={
          action ?? (
            <Action
              instance="stage-open-catalogue"
              label="Open catalogue in a new tab"
              tone="primary"
              size="md"
              icon="external"
            />
          )
        }
      />
    </StageCard>
  );
}
