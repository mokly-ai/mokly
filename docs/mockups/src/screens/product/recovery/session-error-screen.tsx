import type { Viewport } from "@mokly/mokly";

import { failureReference } from "../../../fixtures/product-states";
import { AccountShell } from "../account/account-shell";
import { Action, StateMessage } from "../page-parts";

/** The failure, which the heading shows and the alert announces. */
const title = "Mokly couldn’t load";

/**
 * Any product route whose session read failed, in the account panel. The
 * panel's heading names the failure, so the alert announces it for screen
 * readers only rather than repeat it as a second, visible title. Nobody is
 * known while the session is unread, so the header names no one.
 */
function SessionErrorPage({ screen }: { screen: string }) {
  return (
    <AccountShell id={screen} title={title} identity={{ kind: "none" }}>
      <StateMessage
        announcement={title}
        error
        reference={failureReference}
        action={
          <Action label="Try again" tone="primary" size="md" icon="retry" />
        }
      />
    </AccountShell>
  );
}

export function SessionErrorScreen(_props: { viewport: Viewport }) {
  return <SessionErrorPage screen="product/recovery/session-error" />;
}

export function SessionErrorEmptyScreen(_props: { viewport: Viewport }) {
  return <SessionErrorPage screen="product/recovery/session-error/empty" />;
}

export function SessionErrorLoadingScreen(_props: { viewport: Viewport }) {
  return <SessionErrorPage screen="product/recovery/session-error/loading" />;
}

export function SessionErrorErrorScreen(_props: { viewport: Viewport }) {
  return <SessionErrorPage screen="product/recovery/session-error/error" />;
}
