import type { Viewport } from "@mokly/mokly";

import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import { StatePlaceholder } from "../placeholders";

import { AccountShell } from "./account-shell";

type CallbackFailure = {
  id: string;
  title: string;
  message?: string;
  retry?: boolean;
};

function CallbackActions({ retry = false }: { retry?: boolean }) {
  return (
    <div className="fo-account-actions">
      {retry && <Action label="Try again" tone="primary" icon="retry" block />}
      <Action
        label="Back to sign in"
        tone={retry ? "secondary" : "primary"}
        icon={retry ? undefined : "retry"}
        block
        to="product/account/sign-in"
      />
    </div>
  );
}

function CallbackFailurePage({ id, title, message, retry }: CallbackFailure) {
  return (
    <AccountShell id={id} title={title} identity={{ kind: "none" }}>
      {message ? (
        <StateMessage title={message} error reference={failureReference} />
      ) : (
        <StateMessage announcement={title} error reference={failureReference} />
      )}
      <CallbackActions retry={retry} />
    </AccountShell>
  );
}

/**
 * The shared landing while either sign-in credential is being exchanged. Its
 * success replaces the route, so it waits as one state card in placeholder
 * form. The heading already names the operation, so the card's title is a
 * bar and screen readers still hear the name.
 */
export function CallbackPendingScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/callback"
      title="Signing you in"
      identity={{ kind: "none" }}
    >
      <Pending label="Signing you in" labelMode="screen-reader-only">
        <StatePlaceholder />
      </Pending>
    </AccountShell>
  );
}

/** The email landing when its credential is absent or invalid. */
export function EmailCallbackInvalidScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/email-invalid"
      title="This link isn’t valid"
      message="Request another sign-in link"
    />
  );
}

/** The email landing when its credential has expired. */
export function EmailCallbackExpiredScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/email-invalid/expired"
      title="This link has expired"
      message="Request another sign-in link"
    />
  );
}

/** The email landing when its one-use credential has already been exchanged. */
export function EmailCallbackUsedScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/email-invalid/used"
      title="This link has already been used"
      message="Request another sign-in link"
    />
  );
}

/** The email landing for an unclassified API or transport failure. */
export function EmailCallbackFailureScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/email-invalid/failure"
      title="We couldn’t sign you in"
      message="Request another sign-in link"
    />
  );
}

/**
 * The email landing in a browser when the desktop app requested the link: it
 * holds the credential until the reader chooses where to finish signing in.
 */
export function CallbackDesktopHandoffScreen(_props: { viewport: Viewport }) {
  return (
    <AccountShell
      id="product/account/callback/desktop"
      title="Finish signing in"
      detail="You requested this link from the Mokly app."
      identity={{ kind: "none" }}
    >
      <div className="fo-account-actions">
        <Action label="Open Mokly" tone="primary" icon="external" block />
        <Action label="Continue in browser" tone="secondary" block />
      </div>
    </AccountShell>
  );
}

/** The preview landing when its credential is absent or invalid. */
export function PreviewCallbackInvalidScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/preview-invalid"
      title="This link isn’t valid"
    />
  );
}

/** The preview landing when another attempt can recover the request. */
export function PreviewCallbackFailureScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/preview-invalid/failure"
      title="We couldn’t sign you in"
      retry
    />
  );
}
