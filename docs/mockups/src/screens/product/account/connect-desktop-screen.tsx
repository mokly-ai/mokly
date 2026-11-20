import type { Viewport } from "@mokly/mokly";

import { WriteFailure } from "../../../entries/design/write-failure.mockup";
import type { ScreenState } from "../../../fixtures/product-states";
import {
  causes,
  failureReference,
  onboarding,
  stateScreenPath,
} from "../../../fixtures/product-states";
import { Action, StateMessage } from "../page-parts";

import { AccountShell } from "./account-shell";

/**
 * The four states, the page once Open Mokly has handed the grant over, and the
 * page while the session read runs.
 */
type ConnectState = ScreenState | "opened" | "session-loading";

/** What the page is titled in each state. */
const titles: Record<ConnectState, string> = {
  default: "Sign in to the Mokly app",
  empty: "This link isn’t valid",
  loading: "Sign in to the Mokly app",
  error: "Sign in to the Mokly app",
  opened: "Continue in the Mokly app",
  "session-loading": "Sign in to the Mokly app",
};

/**
 * Open Mokly in each state that draws it. It leaves the browser, so it carries
 * the external glyph whatever it reads. The grant opens the app's landing,
 * which is the shared sign-in landing while the exchange runs. While the
 * request runs, the control keeps its place, busy with its working word, and
 * refuses a second press; a refused request makes it the way to try again.
 * While the session read runs, its label is known, so it draws itself,
 * disabled.
 */
function OpenMokly({ state }: { state: ConnectState }) {
  const open =
    state === "loading" ? (
      <Action
        label="Opening…"
        tone="primary"
        icon="external"
        block
        busy="Opening Mokly"
      />
    ) : (
      <Action
        label={state === "error" ? "Try again" : "Open Mokly"}
        to={
          state === "default" || state === "opened"
            ? "product/account/callback"
            : undefined
        }
        tone="primary"
        icon="external"
        block
        disabled={state === "session-loading"}
      />
    );
  return state === "error" ? (
    <WriteFailure
      moklyInstance="connect-desktop-failure"
      cause={causes.busy}
      reference={failureReference}
      control={open}
    />
  ) : (
    open
  );
}

/**
 * The connect page in the browser, at `/connect/desktop`. It names the
 * browser's account before the app receives it, and requests the grant only
 * when the reader presses Open Mokly. Use another account signs the browser
 * out and returns to sign in. A link without one valid challenge sends no
 * request, so its state has no reference and nothing to press. The page is
 * signed in, so the header names the reader.
 *
 * While the session read runs, the page draws its confirmation, the layout a
 * signed-in reader gets: the title and both controls are known, so they draw
 * themselves, disabled, and the header holds the identity's placeholder. The
 * line under the title names the account the session decides, so it names
 * the read in its place.
 */
function ConnectDesktopPage({ state }: { state: ConnectState }) {
  const confirming = state !== "empty" && state !== "opened";
  const waits = state === "session-loading";
  const id = stateScreenPath("product/account/connect-desktop", state);
  const actions = (
    <div className="fo-account-actions">
      <OpenMokly state={state} />
      {confirming && (
        <Action
          label="Use another account"
          to={waits ? undefined : "product/account/sign-in"}
          tone="secondary"
          block
          disabled={waits}
        />
      )}
    </div>
  );
  if (waits)
    return (
      <AccountShell
        id={id}
        title={titles[state]}
        identity={{ kind: "waiting" }}
        wait="Loading your account"
        detail={(name) => name}
      >
        {actions}
      </AccountShell>
    );
  return (
    <AccountShell
      id={id}
      title={titles[state]}
      detail={
        confirming ? (
          <>
            Signed in as{" "}
            <span className="fo-account-address">{onboarding.email}</span>
          </>
        ) : undefined
      }
      identity={{ kind: "signed-in" }}
    >
      {state === "empty" ? (
        <StateMessage error>Sign in again from the Mokly app.</StateMessage>
      ) : (
        actions
      )}
    </AccountShell>
  );
}

export function ConnectDesktopScreen(_props: { viewport: Viewport }) {
  return <ConnectDesktopPage state="default" />;
}

/** The link carries no valid challenge, so the page sends no request. */
export function ConnectDesktopEmptyScreen(_props: { viewport: Viewport }) {
  return <ConnectDesktopPage state="empty" />;
}

/** The grant request in flight after Open Mokly, busy on its control. */
export function ConnectDesktopLoadingScreen(_props: { viewport: Viewport }) {
  return <ConnectDesktopPage state="loading" />;
}

/** The grant request refused, reported beside the control that sent it. */
export function ConnectDesktopErrorScreen(_props: { viewport: Viewport }) {
  return <ConnectDesktopPage state="error" />;
}

/** The grant handed to the app; a later press reuses it until it expires. */
export function ConnectDesktopOpenedScreen(_props: { viewport: Viewport }) {
  return <ConnectDesktopPage state="opened" />;
}

/** The page while the session read runs, in its confirmation's layout. */
export function ConnectDesktopSessionLoadingScreen(_props: {
  viewport: Viewport;
}) {
  return <ConnectDesktopPage state="session-loading" />;
}
