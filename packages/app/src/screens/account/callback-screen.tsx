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
import { one } from "../../navigation/provider-query";
import { validateReturnTo } from "../../navigation/return-to";
import { useSession } from "../../session/context";

import { AccountShell } from "./account-shell";

const emailRecovery: Partial<Record<ApiError["reason"], string>> = {
  "magic-link-expired": "This link has expired",
  "magic-link-used": "This link has already been used",
};

function title(missing: boolean, error: ApiError | undefined): string {
  if (missing) {
    return "This link isn’t valid";
  }
  return error
    ? (emailRecovery[error.reason] ?? "We couldn’t sign you in")
    : "Signing you in";
}

/** Exchange a one-use email sign-in token. */
export function CallbackScreen() {
  const router = useRouter();
  const { adopt } = useSession();
  const [error, setError] = useState<ApiError | undefined>();
  const [missing, setMissing] = useState(false);
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
      setMissing(true);
      return;
    }
    async function exchange(value: string) {
      try {
        const issued = await verifyMagicLink(value);
        if (!mounted.current) return;
        adopt(issued.session);
        replaceAddress(router, validateReturnTo(issued.returnTo));
      } catch (caught: unknown) {
        if (mounted.current) setError(asApiError(caught) ?? unexpectedError());
      }
    }
    void exchange(token);
  }, [adopt, router]);

  const failed = missing || error !== undefined;

  return (
    <AccountShell
      screen="account-callback"
      title={title(missing, error)}
      identity={{ kind: "none" }}
    >
      {failed ? (
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
              href="/sign-in"
            />
          </div>
        </>
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
