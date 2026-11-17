import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

import { asApiError, unexpectedError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import type { User } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { Pending, StateMessage } from "../../components/page-parts";
import { StatePlaceholder } from "../../components/placeholders";
import { acceptInvitation, getWorkspace } from "../../data/workspaces";
import { replaceAddress } from "../../navigation/address";
import { signInHref } from "../../navigation/destinations";
import {
  dashboardPath,
  invitationAcceptancePath,
  workspacePath,
} from "../../navigation/paths";
import { RequireSession } from "../../session/guard";
import { useSession } from "../../session/context";
import { AccountShell } from "./account-shell";
import type { WaitingIdentity } from "./account-shell";

type Step = "accept" | "open";
type Acceptance =
  | { status: "pending"; step: Step }
  | { status: "failed"; step: Step; error: ApiError };

/**
 * The acceptance while it runs, and the session read before it: the title
 * over one state card placeholder. Success opens the workspace, so there is no
 * layout of its own to wait for. "Joining the workspace" already names the
 * acceptance, so the card's title is a bar and screen readers hear the name.
 */
function AcceptanceWait({ identity }: { identity: WaitingIdentity }) {
  return (
    <AccountShell
      screen="account-invitation-accept"
      title="Joining the workspace"
      identity={identity}
    >
      <Pending label="Accepting invitation" labelMode="screen-reader-only">
        <StatePlaceholder />
      </Pending>
    </AccountShell>
  );
}

function SignedInAcceptance({
  workspaceId,
  memberId,
  user,
}: {
  workspaceId: string;
  memberId: string;
  user: User;
}) {
  const email = user.email;
  const router = useRouter();
  const { reload } = useSession();
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<Acceptance>({
    status: "pending",
    step: "accept",
  });
  const accepted = useRef<{
    email: string;
    workspaceId: string;
    memberId: string;
  } | null>(null);
  const route = invitationAcceptancePath(workspaceId, memberId);

  useEffect(() => {
    let current = true;
    let step: Step =
      accepted.current?.email === email &&
      accepted.current.workspaceId === workspaceId &&
      accepted.current.memberId === memberId
        ? "open"
        : "accept";
    setState({ status: "pending", step });
    async function accept() {
      try {
        if (step === "accept") {
          await acceptInvitation(workspaceId, memberId);
          if (!current) return;
          accepted.current = { email, workspaceId, memberId };
          step = "open";
          setState({ status: "pending", step });
        }
        const workspace = await getWorkspace(workspaceId);
        if (current) replaceAddress(router, workspacePath(workspace.slug));
      } catch (caught) {
        if (!current) return;
        const error = asApiError(caught) ?? unexpectedError();
        if (error.signedOut) {
          void reload();
          return;
        }
        setState({ status: "failed", step, error });
      }
    }
    void accept();
    return () => {
      current = false;
    };
  }, [attempt, email, memberId, workspaceId, reload, router]);

  const acceptError =
    state.status === "failed" && state.step === "accept"
      ? state.error
      : undefined;
  const openError =
    state.status === "failed" && state.step === "open"
      ? state.error
      : undefined;
  const missing = acceptError?.reason === "not-found";
  const expired = acceptError?.reason === "invitation-expired";
  const opening = state.status === "pending" && state.step === "open";
  if (state.status === "pending" && state.step === "accept") {
    return <AcceptanceWait identity={{ kind: "signed-in", user }} />;
  }
  return (
    <AccountShell
      screen="account-invitation-accept"
      title={
        openError || opening
          ? "Invitation accepted"
          : expired
            ? "This invitation has expired"
            : missing
              ? "This invitation isn’t available for this account"
              : "We couldn’t accept your invitation"
      }
      identity={{ kind: "signed-in", user }}
    >
      {openError ? (
        <StateMessage
          title="We couldn’t open your workspace"
          error
          details={<ErrorDetails reference={openError.requestId} />}
          action={
            <Action
              label="Try again"
              tone="primary"
              onPress={() => setAttempt((previous) => previous + 1)}
            />
          }
        />
      ) : expired ? (
        <StateMessage
          title="Ask for a new invitation"
          error
          details={<ErrorDetails reference={acceptError.requestId} />}
          action={
            <Action
              label="Open dashboard"
              tone="primary"
              href={dashboardPath}
            />
          }
        />
      ) : missing ? (
        <StateMessage
          title="Sign in with the invited address"
          error
          details={<ErrorDetails reference={acceptError.requestId} />}
          action={
            <Action
              label="Sign in with another email"
              tone="primary"
              href={signInHref(route)}
            />
          }
        >
          If you’re already using that address, ask for a new invitation.
        </StateMessage>
      ) : acceptError ? (
        <StateMessage
          announcement="We couldn’t accept your invitation"
          error
          details={<ErrorDetails reference={acceptError.requestId} />}
          action={
            <Action
              label="Try again"
              tone="primary"
              onPress={() => setAttempt((previous) => previous + 1)}
            />
          }
        />
      ) : (
        // Its heading says the invitation is accepted, so the card's title is
        // the place that names what the reader waits for now.
        <Pending label="Opening your workspace">
          {(name) => <StatePlaceholder title={name} />}
        </Pending>
      )}
    </AccountShell>
  );
}

/** Accept after sign-in, then open the workspace's current address. */
export function InvitationAcceptScreen({
  workspaceId,
  memberId,
}: {
  workspaceId: string;
  memberId: string;
}) {
  return (
    <RequireSession
      returnTo={invitationAcceptancePath(workspaceId, memberId)}
      waiting={<AcceptanceWait identity={{ kind: "waiting" }} />}
    >
      {(session) => (
        <SignedInAcceptance
          workspaceId={workspaceId}
          memberId={memberId}
          user={session.user}
        />
      )}
    </RequireSession>
  );
}
