import type { Viewport } from "@mokly/mokly";

import { failureReference } from "../../../fixtures/product-states";
import { Action, Pending, StateMessage } from "../page-parts";
import { StatePlaceholder } from "../placeholders";

import { AccountShell } from "./account-shell";

/**
 * Where Back to sign in leads: sign in in the browser, or the entry screen of
 * the desktop app's window, which is what `/sign-in` draws there.
 */
type SignIn = "product/account/sign-in" | "product/account/sign-in/desktop";

type CallbackFailure = {
  id: string;
  title: string;
  message?: string;
  retry?: boolean;
  signIn?: SignIn;
};

function CallbackActions({
  retry = false,
  signIn,
}: {
  retry?: boolean;
  signIn: SignIn;
}) {
  return (
    <div className="fo-account-actions">
      {retry && <Action label="Try again" tone="primary" icon="retry" block />}
      <Action
        label="Back to sign in"
        tone={retry ? "secondary" : "primary"}
        icon={retry ? undefined : "retry"}
        block
        to={signIn}
      />
    </div>
  );
}

function CallbackFailurePage({
  id,
  title,
  message,
  retry,
  signIn = "product/account/sign-in",
}: CallbackFailure) {
  return (
    <AccountShell id={id} title={title} identity={{ kind: "none" }}>
      {message ? (
        <StateMessage title={message} error reference={failureReference} />
      ) : (
        <StateMessage announcement={title} error reference={failureReference} />
      )}
      <CallbackActions retry={retry} signIn={signIn} />
    </AccountShell>
  );
}

/**
 * The shared landing while any sign-in credential is being exchanged. Its
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

/**
 * The desktop landing in the app's window when the grant is expired, used or
 * unmatched, or arrived without its verifier while the window is signed out.
 * The grant is single use, so the way on is the window's entry, never a retry.
 */
export function DesktopCallbackExpiredScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/desktop-expired"
      title="This sign-in has expired"
      signIn="product/account/sign-in/desktop"
    />
  );
}

/** The desktop landing for an unclassified API or transport failure. */
export function DesktopCallbackFailureScreen(_props: { viewport: Viewport }) {
  return (
    <CallbackFailurePage
      id="product/account/callback/desktop-expired/failure"
      title="We couldn’t sign you in"
      signIn="product/account/sign-in/desktop"
    />
  );
}
