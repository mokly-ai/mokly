import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Pending, StateMessage } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { exchangeDesktopGrant } from "../../data/auth";
import { replaceAddress } from "../../navigation/address";
import { takeCallbackInput } from "../../navigation/callback-input";
import { takeDesktopVerifier } from "../../navigation/desktop-sign-in";
import { dashboardPath, signInPath } from "../../navigation/paths";
import { one } from "../../navigation/provider-query";
import { validateReturnTo } from "../../navigation/return-to";
import { useSession } from "../../session/context";

import { AccountShell } from "./account-shell";

/** What a refused or failed exchange is called. */
function failureTitle(error: ApiError): string {
  return error.reason === "desktop-grant-invalid"
    ? "This sign-in has expired"
    : "We couldn’t sign you in";
}

/**
 * A failed landing: the shared problem alert that announces the screen title,
 * with the request details of an API failure, and the one way on. The grant
 * is single use, so no state offers a retry: Back to sign in opens the
 * window's entry screen, which starts again with a new verifier.
 */
function Failed({ title, error }: { title: string; error?: ApiError }) {
  return (
    <AccountShell
      screen="account-desktop-callback"
      title={title}
      identity={{ kind: "none" }}
    >
      <StateMessage
        announcement={title}
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
    </AccountShell>
  );
}

/**
 * `/auth/desktop/callback` in the desktop app's window. It takes the grant the
 * application entry captured from its fragment and the verifier the window's
 * entry screen kept in this tab, both once, and exchanges them whatever the
 * session state, so the window adopts the browser's account and resumes the
 * destination the grant carries. A landing without both sends no request: it
 * waits for the session read, sends a signed-in window to the dashboard and
 * tells a signed-out one its sign-in has expired. It renders no part of either
 * value.
 */
export function DesktopCallbackScreen() {
  const router = useRouter();
  const { state, adopt, reload } = useSession();
  // Whether the landing started without both values, and so waits for the
  // session read instead of exchanging them.
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const started = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Taken from an effect rather than a render, because a render can be
  // repeated or discarded while the captured grant and the stored verifier
  // cannot. The verifier is taken whether or not a grant arrived.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const grant = one(takeCallbackInput("desktop"), "grant");
    const verifier = takeDesktopVerifier();
    if (grant === undefined || verifier === undefined) {
      setMissing(true);
      return;
    }
    exchangeDesktopGrant({ grant, verifier })
      .then((issued) => {
        if (!mounted.current) return;
        adopt(issued.session);
        replaceAddress(router, validateReturnTo(issued.returnTo));
      })
      .catch((caught: unknown) => {
        if (!mounted.current) return;
        setError(asApiError(caught) ?? unexpectedError());
      });
  }, [adopt, router]);

  const signedInWithoutInput = missing && state.status === "signed-in";
  useEffect(() => {
    if (signedInWithoutInput) replaceAddress(router, dashboardPath);
  }, [router, signedInWithoutInput]);

  if (error) return <Failed title={failureTitle(error)} error={error} />;
  if (missing && state.status === "signed-out") {
    return <Failed title="This sign-in has expired" />;
  }
  if (missing && state.status === "error") {
    const title = "Mokly couldn’t load";
    return (
      <AccountShell
        screen="account-desktop-callback"
        title={title}
        identity={{ kind: "none" }}
      >
        <StateMessage
          announcement={title}
          error
          details={<ErrorDetails reference={state.error.requestId} />}
          action={
            <Action
              label="Try again"
              tone="primary"
              icon="retry"
              onPress={reload}
            />
          }
        />
      </AccountShell>
    );
  }
  return (
    <AccountShell
      screen="account-desktop-callback"
      title="Signing you in"
      identity={{ kind: "none" }}
    >
      {/* Success replaces the route, so the landing waits as the shared
          landing does: one state card in its placeholder form. The heading
          already says Signing you in, so the card's title is a bar and screen
          readers hear the name. */}
      <Pending label="Signing you in" labelMode="screen-reader-only">
        <StatePlaceholder />
      </Pending>
    </AccountShell>
  );
}
