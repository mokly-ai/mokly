import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Pending, StateMessage } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { verifyGitHubCallback } from "../../data/auth";
import { replaceAddress } from "../../navigation/address";
import { takeCallbackInput } from "../../navigation/callback-input";
import { consumeGitHubCallback } from "../../navigation/github-flow";
import type { GitHubCallbackAttempt } from "../../navigation/github-flow";
import { validateReturnTo } from "../../navigation/return-to";
import { useSession } from "../../session/context";

import { AccountShell } from "./account-shell";

interface Recovery {
  title: string;
  /** The one line beneath the title, where the title is not the whole message. */
  line?: string;
  action: string;
  href: string;
}

/**
 * Where a refused attempt is recovered from. The account pane is the one place
 * that starts a signed-in connection, so a connection purpose returns to it.
 */
function recoveryHref(attempt: GitHubCallbackAttempt): string {
  if (attempt.status === "invalid" || attempt.purpose === "sign-in") {
    return "/sign-in";
  }
  return attempt.purpose === "connect" ? "/settings/account" : "/install";
}

function localRecovery(attempt: GitHubCallbackAttempt): Recovery {
  if (attempt.status !== "invalid" && attempt.purpose === "install-authorize") {
    return {
      title: "Installation wasn’t completed",
      action: "Back to install",
      href: recoveryHref(attempt),
    };
  }
  return {
    title: "GitHub sign-in expired",
    action: "Back to sign in",
    href: recoveryHref(attempt),
  };
}

/**
 * What a refused installation authorization means. Another workspace holding
 * the account is the one refusal only that workspace can undo, so its line
 * says where; GitHub not proving the reader administers the account is the
 * whole message in its title. Every other refusal is the trip not completing.
 */
function installationRefused(
  attempt: GitHubCallbackAttempt,
  error: ApiError,
): Recovery {
  if (error.reason === "github-installation-conflict") {
    return {
      title: "This GitHub account is connected to another workspace",
      line: "Remove it from that workspace first.",
      action: "Back to install",
      href: recoveryHref(attempt),
    };
  }
  if (error.reason === "permission-denied") {
    return {
      title: "You don’t administer this GitHub account",
      action: "Back to install",
      href: recoveryHref(attempt),
    };
  }
  return localRecovery(attempt);
}

function refused(attempt: GitHubCallbackAttempt, error: ApiError): Recovery {
  if (attempt.status !== "invalid" && attempt.purpose === "install-authorize") {
    return installationRefused(attempt, error);
  }
  if (error.reason === "github-auth-invalid") return localRecovery(attempt);
  if (error.reason === "github-identity-conflict") {
    // An installation authorization is answered above, so what is left is a
    // sign-in or a connection, which is the pair `recoveryHref` already maps.
    const connection =
      attempt.status !== "invalid" && attempt.purpose === "connect";
    return {
      title: "This GitHub account is connected to another Mokly account",
      action: connection ? "Back to account" : "Back to sign in",
      href: recoveryHref(attempt),
    };
  }
  if (error.reason === "operation-unavailable") {
    return {
      title: "GitHub sign-in opens soon",
      action: "Continue with email",
      href: recoveryHref(attempt),
    };
  }
  return {
    title: "GitHub sign-in failed",
    action: "Back to sign in",
    href: recoveryHref(attempt),
  };
}

/**
 * The landing's wait: success replaces the route, so it waits as one state
 * card in its placeholder form, and its title, which does not name the
 * operation, leaves the card's title to name it.
 */
function namedCard(name: ReactNode) {
  return <StatePlaceholder title={name} />;
}

/** Complete GitHub sign-in, account connection or installation authorization. */
export function GitHubCallbackScreen() {
  const router = useRouter();
  const { state, reload, adopt } = useSession();
  const [attempt, setAttempt] = useState<GitHubCallbackAttempt | undefined>();
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const taken = useRef(false);
  const started = useRef(false);
  const sessionBound =
    attempt?.status === "valid" && attempt.purpose !== "sign-in";
  const sessionMissing = sessionBound && state.status === "signed-out";

  useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    setAttempt(consumeGitHubCallback(takeCallbackInput("github-callback")));
  }, []);

  useEffect(() => {
    if (
      started.current ||
      attempt?.status !== "valid" ||
      state.status === "loading" ||
      state.status === "error" ||
      sessionMissing
    ) {
      return;
    }
    started.current = true;
    verifyGitHubCallback(
      {
        code: attempt.code,
        state: attempt.state,
        codeVerifier: attempt.codeVerifier,
      },
      sessionBound,
    )
      .then((issued) => {
        adopt(issued.session);
        replaceAddress(router, validateReturnTo(issued.returnTo));
      })
      .catch((caught: unknown) => {
        setError(asApiError(caught) ?? unexpectedError());
      });
  }, [adopt, attempt, router, sessionBound, sessionMissing, state.status]);

  if (attempt === undefined) return null;

  const recovery =
    attempt.status !== "valid" || sessionMissing
      ? localRecovery(attempt)
      : error
        ? refused(attempt, error)
        : undefined;
  const sessionError =
    attempt.status === "valid" && state.status === "error"
      ? state.error
      : undefined;
  const installation =
    attempt.status !== "invalid" && attempt.purpose === "install-authorize";
  const title =
    sessionError !== undefined
      ? "Mokly couldn’t load"
      : (recovery?.title ??
        (installation ? "GitHub installation" : "GitHub sign-in"));
  // While the session read runs, a flow that needs a session draws the
  // identity's placeholder, because the reader who started it is signed in.
  const identity =
    state.status === "signed-in"
      ? ({ kind: "signed-in", user: state.session.user } as const)
      : state.status === "loading" && sessionBound
        ? ({ kind: "waiting" } as const)
        : ({ kind: "none" } as const);

  return (
    <AccountShell
      screen="account-github-callback"
      title={title}
      identity={identity}
    >
      {sessionError ? (
        <StateMessage
          error
          announcement={title}
          details={<ErrorDetails reference={sessionError.requestId} />}
          action={
            <Action
              label="Try again"
              tone="primary"
              icon="retry"
              onPress={reload}
            />
          }
        />
      ) : recovery ? (
        <>
          {recovery.line ? (
            <StateMessage
              error
              details={
                error ? <ErrorDetails reference={error.requestId} /> : undefined
              }
            >
              {recovery.line}
            </StateMessage>
          ) : (
            <StateMessage
              error
              announcement={title}
              details={
                error ? <ErrorDetails reference={error.requestId} /> : undefined
              }
            />
          )}
          <div className="fo-account-actions">
            <Action
              label={recovery.action}
              tone="primary"
              icon="retry"
              block
              href={recovery.href}
            />
          </div>
        </>
      ) : installation ? (
        <Pending label="Completing installation">{namedCard}</Pending>
      ) : (
        <Pending label="Signing you in">{namedCard}</Pending>
      )}
    </AccountShell>
  );
}
