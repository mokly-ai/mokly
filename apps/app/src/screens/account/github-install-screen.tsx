import { useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Pending, StateMessage } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { completeGitHubInstallation } from "../../data/auth";
import { takeCallbackInput } from "../../navigation/callback-input";
import {
  consumeGitHubInstallation,
  storeGitHubFlow,
} from "../../navigation/github-flow";
import type { GitHubInstallationAttempt } from "../../navigation/github-flow";
import { useLeavePage } from "../../navigation/leave-page";
import { installPath } from "../../navigation/paths";
import { useSession } from "../../session/context";

import { AccountShell } from "./account-shell";

function title(
  attempt: GitHubInstallationAttempt,
  error: ApiError | undefined,
): string {
  if (attempt.status === "invalid" || error?.reason === "github-auth-invalid") {
    return "Installation expired";
  }
  if (error?.reason === "operation-unavailable") {
    return "GitHub installation opens soon";
  }
  return "Installation wasn’t completed";
}

/**
 * The one way on from the setup landing: back to the install step. A refusal
 * carries the retry glyph, as every callback recovery does; a request waiting
 * for approval failed nothing, so it carries none.
 */
function BackToInstall({ refused }: { refused: boolean }) {
  return (
    <div className="fo-account-actions">
      <Action
        label="Back to install"
        tone="primary"
        icon={refused ? "retry" : undefined}
        block
        href={installPath}
      />
    </div>
  );
}

/**
 * Complete GitHub App setup and continue into bound user authorization. A
 * member of a GitHub organization who asked for the App rather than
 * installing it returns with a request, which reached nothing in Mokly: the
 * landing says who finishes the job and sends nothing. A return with no flow
 * behind it never reaches this screen; the address cleanup hands it to the
 * connect situation before the router starts.
 *
 * Success leaves for GitHub's authorization only while the landing is still
 * shown, and the landing waits until the page has gone. Its input is used by
 * then, so a page the browser brings back from its back-forward cache is the
 * landing reached again, which a reload also shows: the missing-input
 * recovery.
 */
export function GitHubInstallScreen() {
  const { state, reload } = useSession();
  const [attempt, setAttempt] = useState<
    GitHubInstallationAttempt | undefined
  >();
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const taken = useRef(false);
  const started = useRef(false);
  const sessionMissing = state.status === "signed-out";
  const leave = useLeavePage(() => setAttempt({ status: "invalid" }));

  useEffect(() => {
    if (taken.current) return;
    taken.current = true;
    setAttempt(consumeGitHubInstallation(takeCallbackInput("github-install")));
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
    completeGitHubInstallation({
      installationId: attempt.installationId,
      state: attempt.state,
      codeVerifier: attempt.codeVerifier,
    })
      .then((connection) => {
        if (!storeGitHubFlow("install-authorize", connection)) {
          throw unexpectedError();
        }
        leave(connection.authorizeUrl);
      })
      .catch((caught: unknown) => {
        setError(asApiError(caught) ?? unexpectedError());
      });
  }, [attempt, leave, sessionMissing, state.status]);

  if (attempt === undefined) return null;

  // The reader who installs the App is signed in, so while the session read
  // runs the header draws the identity's placeholder.
  const identity =
    state.status === "signed-in"
      ? ({ kind: "signed-in", user: state.session.user } as const)
      : state.status === "loading"
        ? ({ kind: "waiting" } as const)
        : ({ kind: "none" } as const);
  if (attempt.status === "requested") {
    return (
      <AccountShell
        screen="account-github-install"
        title="Installation requested"
        detail="An owner of the GitHub organization approves it on GitHub."
        identity={identity}
      >
        <BackToInstall refused={false} />
      </AccountShell>
    );
  }

  const recovery = attempt.status === "invalid" || sessionMissing || error;
  const sessionError =
    attempt.status === "valid" && state.status === "error"
      ? state.error
      : undefined;
  const recoveryTitle = sessionError
    ? "Mokly couldn’t load"
    : recovery
      ? title(attempt, error)
      : undefined;
  const screenTitle = recoveryTitle ?? "Install the Mokly app";

  return (
    <AccountShell
      screen="account-github-install"
      title={screenTitle}
      identity={identity}
    >
      {sessionError ? (
        <StateMessage
          error
          announcement={screenTitle}
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
          <StateMessage
            error
            announcement={screenTitle}
            details={
              error ? <ErrorDetails reference={error.requestId} /> : undefined
            }
          />
          <BackToInstall refused />
        </>
      ) : (
        // Success leaves for GitHub's authorization, so the landing waits as
        // one state card in its placeholder form. Its title does not name the
        // operation, so the card's title does.
        <Pending label="Completing installation">
          {(name) => <StatePlaceholder title={name} />}
        </Pending>
      )}
    </AccountShell>
  );
}
