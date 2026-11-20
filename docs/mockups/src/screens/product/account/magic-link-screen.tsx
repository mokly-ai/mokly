import type { Viewport } from "@mokly/mokly";
import { MockLink } from "@mokly/mokly";

import { Input } from "../../../entries/design/input.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  failureReference,
  onboarding,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action, StateMessage } from "../page-parts";

import { AccountShell } from "./account-shell";

function ChangeEmail() {
  return (
    <p className="fo-account-switch">
      Wrong address?{" "}
      <MockLink to="product/account/sign-up">Change email</MockLink>
    </p>
  );
}

function MagicLinkBody({ state }: { state: ScreenState }) {
  if (state === "empty")
    return (
      <>
        <Input label="Email" name="link-email" type="email" value="" />
        <div className="fo-account-actions">
          <Action label="Send sign-in link" tone="primary" block disabled />
        </div>
      </>
    );
  if (state === "error")
    return (
      <>
        <StateMessage
          title="We couldn’t send your link"
          error
          reference={failureReference}
        />
        <div className="fo-account-actions">
          <Action
            label="Request another link"
            tone="primary"
            icon="retry"
            block
          />
        </div>
      </>
    );
  // Resending is a write, so while it runs the control carries the wait: its
  // working word and the busy spinner, with nothing inserted around it.
  return (
    <div className="fo-account-actions">
      {state === "loading" ? (
        <Action
          instance="resend-link"
          label="Sending…"
          tone="secondary"
          block
          busy="Sending sign-in link"
        />
      ) : (
        <Action label="Resend link" tone="secondary" block />
      )}
    </div>
  );
}

function MagicLinkPage({ state }: { state: ScreenState }) {
  // A link is outstanding in the canonical drawing and while it is resent.
  const outstanding = state === "default" || state === "loading";
  return (
    <AccountShell
      id={stateScreenPath("product/account/magic-link", state)}
      title="Check your email"
      detail={
        outstanding ? (
          <>
            Open the sign-in link sent to{" "}
            <span className="fo-account-address">{onboarding.email}</span>.
          </>
        ) : undefined
      }
      identity={{
        kind: "link",
        label: "Sign in",
        to: "product/account/sign-in",
      }}
      below={outstanding || state === "error" ? <ChangeEmail /> : undefined}
    >
      <MagicLinkBody state={state} />
    </AccountShell>
  );
}

export function MagicLinkScreen(_props: { viewport: Viewport }) {
  return <MagicLinkPage state="default" />;
}

export function MagicLinkEmptyScreen(_props: { viewport: Viewport }) {
  return <MagicLinkPage state="empty" />;
}

export function MagicLinkLoadingScreen(_props: { viewport: Viewport }) {
  return <MagicLinkPage state="loading" />;
}

export function MagicLinkErrorScreen(_props: { viewport: Viewport }) {
  return <MagicLinkPage state="error" />;
}
