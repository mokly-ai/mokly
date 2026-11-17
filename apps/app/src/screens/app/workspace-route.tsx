import { useRouter } from "expo-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import type { Workspace, Session } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { StateMessage } from "../../components/page-parts";
import {
  getWorkspace,
  getWorkspaceBySlug,
  listWorkspaces,
} from "../../data/workspaces";
import { useResource } from "../../data/use-resource";
import { workspaceResourceScope } from "../../data/resource-invalidation";
import {
  replaceAddress,
  useAddressPathname,
  useAddressSearch,
} from "../../navigation/address";
import { canonicalWorkspaceAddress } from "../../navigation/canonical";
import { createWorkspacePath, dashboardPath } from "../../navigation/paths";
import { RequireSession } from "../../session/guard";
import { AccountShell } from "../account/account-shell";
import type { WaitingIdentity } from "../account/account-shell";

interface WorkspaceRouteInput {
  workspaceSlug?: string;
  workspaceId?: string;
  title: string;
  /**
   * The destination's waiting layout, which the session read, the workspace
   * read and the replacement of a moved or missing workspace's address all
   * draw, for the identity the header draws then.
   */
  waiting: (identity: WaitingIdentity) => ReactNode;
  children: (input: { session: Session; workspace: Workspace }) => ReactNode;
}

async function loadWorkspace(
  workspaceSlug: string | undefined,
  workspaceId: string | undefined,
): Promise<Workspace | undefined> {
  if (workspaceSlug) return getWorkspaceBySlug(workspaceSlug);
  if (workspaceId) return getWorkspace(workspaceId);
  const workspaces = await listWorkspaces();
  return workspaces[0];
}

/** Resolve one slug/UUID-scoped onboarding or settings route. */
export function WorkspaceRoute(input: WorkspaceRouteInput) {
  return (
    <RequireSession waiting={input.waiting({ kind: "waiting" })}>
      {(session) => <Resolved {...input} session={session} />}
    </RequireSession>
  );
}

function Resolved({
  workspaceSlug,
  workspaceId,
  session,
  title,
  waiting,
  children,
}: WorkspaceRouteInput & { session: Session }) {
  const router = useRouter();
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const workspace = useResource(
    () => loadWorkspace(workspaceSlug, workspaceId),
    `workspace:${workspaceSlug ?? ""}:${workspaceId ?? ""}`,
    true,
    (value) => (value ? [workspaceResourceScope(value.id)] : []),
  );
  const missing =
    workspace.state.status === "error" &&
    (workspace.state.error.reason === "not-found" ||
      workspace.state.error.reason === "permission-denied");
  const canonical =
    workspaceSlug && workspace.state.status === "ready" && workspace.state.value
      ? workspace.state.value.slug
      : undefined;
  const moved = canonical !== undefined && canonical !== workspaceSlug;

  useEffect(() => {
    if (missing) router.replace(dashboardPath);
  }, [missing, router]);

  useEffect(() => {
    if (!moved || !canonical) return;
    replaceAddress(
      router,
      canonicalWorkspaceAddress(pathname, search, canonical),
    );
  }, [canonical, moved, pathname, router, search]);

  if (workspace.state.status === "ready" && workspace.state.value && !moved) {
    return <>{children({ session, workspace: workspace.state.value })}</>;
  }
  if (workspace.state.status === "loading" || missing || moved) {
    return <>{waiting({ kind: "signed-in", user: session.user })}</>;
  }
  return (
    <AccountShell
      screen="app-workspace"
      title={title}
      identity={{ kind: "signed-in", user: session.user }}
    >
      {workspace.state.status === "ready" ? (
        <StateMessage
          title="Create a workspace"
          icon="workspace"
          action={
            <Action
              label="Create workspace"
              tone="primary"
              href={createWorkspacePath}
            />
          }
        >
          A project belongs to a workspace.
        </StateMessage>
      ) : (
        <StateMessage
          title="Workspace couldn’t load"
          error
          details={<ErrorDetails reference={workspace.state.error.requestId} />}
          action={
            <Action
              label="Try again"
              tone="primary"
              icon="retry"
              onPress={workspace.reload}
            />
          }
        />
      )}
    </AccountShell>
  );
}
