import { useRouter } from "expo-router";
import { useEffect, useState } from "react";

import { asApiError } from "../../api/errors";
import type { ApiError } from "../../api/errors";
import type { Workspace, User } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { StateMessage } from "../../components/page-parts";
import { resolveHome } from "../../navigation/destinations";
import { dashboardPath } from "../../navigation/paths";
import { RequireSession } from "../../session/guard";
import { AccountShell } from "../account/account-shell";
import type { WaitingIdentity } from "../account/account-shell";
import { ResolverWait } from "./resolver-wait";
import { WorkspaceRoute } from "./workspace-route";

/** The resolver's wait, for the identity the header draws while it runs. */
function HomeWait({ identity }: { identity: WaitingIdentity }) {
  return (
    <ResolverWait
      screen="app-home"
      title="Opening your workspace"
      identity={identity}
    />
  );
}

function Resolver({ workspace, user }: { workspace?: Workspace; user: User }) {
  const router = useRouter();
  const [error, setError] = useState<ApiError | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    resolveHome(workspace)
      .then((destination) => {
        if (live) router.replace(destination.href);
      })
      .catch((caught: unknown) => {
        if (live) setError(asApiError(caught));
      });
    return () => {
      live = false;
    };
  }, [workspace, router, attempt]);

  if (!error) return <HomeWait identity={{ kind: "signed-in", user }} />;
  return (
    <AccountShell
      screen="app-home"
      title="This couldn’t load"
      identity={{ kind: "signed-in", user }}
    >
      <StateMessage
        title="Try again in a moment"
        error
        details={<ErrorDetails reference={error.requestId} />}
      />
      <div className="fo-account-actions">
        <Action
          label="Try again"
          tone="primary"
          icon="retry"
          block
          onPress={() => {
            setError(undefined);
            setAttempt((count) => count + 1);
          }}
        />
      </div>
    </AccountShell>
  );
}

/**
 * `/dashboard` is a resolver, never a page: it ends at
 * the reader's viewer where they have a project, and in onboarding where they
 * have none.
 */
export function HomeRedirect() {
  return (
    <RequireSession
      returnTo={dashboardPath}
      waiting={<HomeWait identity={{ kind: "waiting" }} />}
    >
      {(session) => <Resolver user={session.user} />}
    </RequireSession>
  );
}

/** One workspace slug resolves to its last opened or first project. */
export function WorkspaceHomeRedirect({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  return (
    <WorkspaceRoute
      workspaceSlug={workspaceSlug}
      title="Opening your workspace"
      waiting={(identity) => <HomeWait identity={identity} />}
    >
      {({ session, workspace }) => (
        <Resolver workspace={workspace} user={session.user} />
      )}
    </WorkspaceRoute>
  );
}
