import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Pending, StateMessage } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { verifyMagicLink } from "../../data/auth";
import { replaceAddress } from "../../navigation/address";
import { takeCallbackInput } from "../../navigation/callback-input";
import { signInPath } from "../../navigation/paths";
import { one } from "../../navigation/provider-query";
import { validateReturnTo } from "../../navigation/return-to";
import { useSession } from "../../session/context";

import { AccountShell } from "./account-shell";

/** The heading of each state of a landing that could not sign the reader in. */
const headings = {
  invalid: "This link isn’t valid",
  expired: "This link has expired",
  used: "This link has already been used",
  failed: "We couldn’t sign you in",
} as const;

type FailedState = keyof typeof headings;

/**
 * The API's refusals of the token that have a state of their own. Every other
 * API or transport failure is `failed`.
 */
const refusals: Partial<Record<ApiError["reason"], FailedState>> = {
  "magic-link-invalid": "invalid",
  "magic-link-expired": "expired",
  "magic-link-used": "used",
};

/**
 * Why the landing could not sign the reader in: its fragment held no single
 * token, so it sent no request, or the exchange failed with this error.
 */
export type CallbackFailure =
  { missing: true; error?: never } | { missing?: never; error: ApiError };

/**
 * A missing token is an invalid link, and so is a token that the API refuses
 * as `magic-link-invalid`: malformed, unknown, or pruned since it was issued.
 */
function failedState(error: ApiError | undefined): FailedState {
  return error ? (refusals[error.reason] ?? "failed") : "invalid";
}

/**
 * The body of a landing that could not sign the reader in: the request for
 * another link with an API failure's request details, and Back to sign in as
 * the one way on.
 */
function CallbackRecovery({ error }: { error?: ApiError }) {
  return (
    <>
      <StateMessage
        title="Request another sign-in link"
        error
        details={
          error ? <ErrorDetails reference={error.requestId} /> : undefined
        }
      />
      <div className="fo-account-actions">
        <Action
          label="Back to sign in"
          tone="primary"
          icon="retry"
          block
          href={signInPath}
        />
      </div>
    </>
  );
}

/**
 * The email landing in each of its states: one account shell, whose heading
 * and body follow the state. Without a failure, the landing waits for the
 * exchange. A failure draws the heading of its state over the recovery.
 *
 * The wait and every failure are the same shell element, so when a failure
 * replaces the wait, the frame around the panel, with its skip link, header
 * and footer, stays in place, and so does focus.
 */
export function EmailLanding({ failure }: { failure?: CallbackFailure }) {
  return (
    <AccountShell
      screen="account-callback"
      title={failure ? headings[failedState(failure.error)] : "Signing you in"}
      identity={{ kind: "none" }}
    >
      {failure ? (
        <CallbackRecovery error={failure.error} />
      ) : (
        // Success replaces the route, so the landing waits as one state card
        // in its placeholder form. The heading already says Signing you in,
        // so the card's title is a bar and screen readers hear the name.
        <Pending label="Signing you in" labelMode="screen-reader-only">
          <StatePlaceholder />
        </Pending>
      )}
    </AccountShell>
  );
}

/** Exchange a one-use email sign-in token. */
export function CallbackScreen() {
  const router = useRouter();
  const { adopt } = useSession();
  const [failure, setFailure] = useState<CallbackFailure | undefined>();
  const mounted = useRef(true);
  const started = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // The input is taken once, from an effect rather than a render, because a
  // render can be repeated or discarded while the captured credential cannot.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = one(takeCallbackInput("email"), "token");
    if (!token) {
      setFailure({ missing: true });
      return;
    }
    async function exchange(value: string) {
      try {
        const issued = await verifyMagicLink(value);
        if (!mounted.current) return;
        adopt(issued.session);
        replaceAddress(router, validateReturnTo(issued.returnTo));
      } catch (caught: unknown) {
        if (!mounted.current) return;
        setFailure({ error: asApiError(caught) ?? unexpectedError() });
      }
    }
    void exchange(token);
  }, [adopt, router]);

  return <EmailLanding failure={failure} />;
}
