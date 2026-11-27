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
 * The browser keeps every credential of the publication's host out of this
 * page, so asking again cannot work, and the catalogue's own tab would hold
 * none either. The card is final: it offers no action, and its line sends the
 * reader to a browser on a computer that opens the publication.
 */
export function StageAccessBlocked() {
  return (
    <StageCard>
      <StateMessage title="This publication can’t open in this browser" error>
        Open it in Chrome, Edge or Firefox on a computer.
      </StateMessage>
    </StageCard>
  );
}
