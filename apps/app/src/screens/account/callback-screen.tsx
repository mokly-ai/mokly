import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import type { SessionIssued } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Pending, StateMessage } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { verifyMagicLink, verifyPreviewSignIn } from "../../data/auth";
import { currentSearch, replaceAddress } from "../../navigation/address";
import { takeCallbackInput } from "../../navigation/callback-input";
import {
  desktopHandoffAddress,
  offersDesktopHandoff,
} from "../../navigation/desktop-shell";
import { one } from "../../navigation/provider-query";
import { validateReturnTo } from "../../navigation/return-to";
import { useSession } from "../../session/context";
import { AccountShell } from "./account-shell";
import { CallbackHandoff } from "./callback-handoff";

type LinkLanding = "email" | "preview";

const emailRecovery = {
  "magic-link-expired": "This link has expired",
  "magic-link-used": "This link has already been used",
  "magic-link-invalid": "This link isn’t valid",
} as const;

function exchange(
  landing: LinkLanding,
  credential: string,
): Promise<SessionIssued> {
  return landing === "email"
    ? verifyMagicLink(credential)
    : verifyPreviewSignIn(credential);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function title(
  landing: LinkLanding,
  missing: boolean,
  error: ApiError | undefined,
): string {
  if (missing || error?.reason === "magic-link-invalid") {
    return "This link isn’t valid";
  }
  if (landing === "email" && error && error.reason in emailRecovery) {
    return emailRecovery[error.reason as keyof typeof emailRecovery];
  }
  return error ? "We couldn’t sign you in" : "Signing you in";
}

function CallbackRecovery({
  details,
  retry,
  onRetry,
}: {
  details?: ReactNode;
  retry: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {details}
      <div className="fo-account-actions">
        {retry && (
          <Action
            label="Try again"
            tone="primary"
            icon="retry"
            block
            onPress={onRetry}
          />
        )}
        <Action
          label="Back to sign in"
          tone={retry ? "secondary" : "primary"}
          icon={retry ? undefined : "retry"}
          block
          href="/sign-in"
        />
      </div>
    </>
  );
}

/**
 * Exchange an email or preview fragment credential through one landing. An
 * email link the desktop app requested is first offered back to the app when
 * this page is not the app, and is exchanged only if the reader continues here.
 */
export function CallbackScreen({ landing }: { landing: LinkLanding }) {
  const router = useRouter();
  const { adopt } = useSession();
  const [error, setError] = useState<ApiError | undefined>();
  const [missing, setMissing] = useState(false);
  // The scheme address that hands the held token to the desktop app, while
  // the landing offers that handoff instead of exchanging the token.
  const [handoff, setHandoff] = useState<string | undefined>();
  const credential = useRef<string | undefined>(undefined);
  const retryAt = useRef(0);
  const running = useRef(false);
  const mounted = useRef(true);
  const started = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const submit = useCallback(
    async (value: string) => {
      if (running.current) return;
      running.current = true;
      setError(undefined);
      const delay = retryAt.current - Date.now();
      if (delay > 0) await wait(delay);
      if (!mounted.current) {
        running.current = false;
        return;
      }
      try {
        const issued = await exchange(landing, value);
        if (!mounted.current) return;
        adopt(issued.session);
        replaceAddress(router, validateReturnTo(issued.returnTo));
      } catch (caught: unknown) {
        if (!mounted.current) return;
        const next = asApiError(caught) ?? unexpectedError();
        retryAt.current = Date.now() + (next.retryAfterSeconds ?? 0) * 1_000;
        setError(next);
      } finally {
        running.current = false;
      }
    },
    [adopt, landing, router],
  );

  // The input is taken once, from an effect rather than a render, because a
  // render can be repeated or discarded while the captured credential cannot.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const field = landing === "email" ? "token" : "secret";
    const value = one(takeCallbackInput(landing), field);
    if (!value) {
      setMissing(true);
      return;
    }
    credential.current = value;
    if (landing === "email" && offersDesktopHandoff(currentSearch())) {
      setHandoff(desktopHandoffAddress(value));
      return;
    }
    void submit(value);
  }, [landing, submit]);

  const invalid = missing || error?.reason === "magic-link-invalid";
  const failed = missing || error !== undefined;
  const retryable = landing === "preview" && error !== undefined && !invalid;
  const screenTitle = title(landing, missing, error);
  const retry = () => {
    const value = credential.current;
    if (value) void submit(value);
  };
  const continueInBrowser = () => {
    setHandoff(undefined);
    retry();
  };

  if (handoff !== undefined) {
    return <CallbackHandoff address={handoff} onContinue={continueInBrowser} />;
  }

  return (
    <AccountShell
      screen="account-callback"
      title={screenTitle}
      identity={{ kind: "none" }}
    >
      {failed ? (
        <CallbackRecovery
          retry={retryable}
          onRetry={retry}
          details={
            landing === "email" ? (
              <StateMessage
                title="Request another sign-in link"
                error
                details={
                  error ? (
                    <ErrorDetails reference={error.requestId} />
                  ) : undefined
                }
              />
            ) : (
              <StateMessage
                announcement={screenTitle}
                error
                details={
                  error ? (
                    <ErrorDetails reference={error.requestId} />
                  ) : undefined
                }
              />
            )
          }
        />
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
