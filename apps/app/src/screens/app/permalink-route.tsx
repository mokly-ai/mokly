import { useRouter } from "expo-router";
import { useEffect } from "react";

import type { ApiError } from "../../api/errors";
import type { Session } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { StateMessage } from "../../components/page-parts";
import { getProject } from "../../data/projects";
import { getWorkspace } from "../../data/workspaces";
import { useResource } from "../../data/use-resource";
import {
  workspaceResourceScope,
  projectResourceScope,
} from "../../data/resource-invalidation";
import {
  replaceAddress,
  useAddressPathname,
  useAddressSearch,
} from "../../navigation/address";
import { canonicalProjectPermalink } from "../../navigation/canonical";
import { dashboardPath, workspacePath } from "../../navigation/paths";
import { RequireSession } from "../../session/guard";
import { AccountShell } from "../account/account-shell";
import type { WaitingIdentity } from "../account/account-shell";
import { ResolverWait } from "./resolver-wait";

/** The permalink's wait, for the identity the header draws while it runs. */
function PermalinkWait({ identity }: { identity: WaitingIdentity }) {
  return (
    <ResolverWait
      screen="app-permalink"
      title="Opening your project"
      identity={identity}
    />
  );
}

function RedirectState({
  session,
  error,
  retry,
}: {
  session: Session;
  error?: ApiError;
  retry: () => void;
}) {
  if (!error) {
    return (
      <PermalinkWait identity={{ kind: "signed-in", user: session.user }} />
    );
  }
  return (
    <AccountShell
      screen="app-permalink"
      title="This link couldn’t open"
      identity={{ kind: "signed-in", user: session.user }}
    >
      <StateMessage
        title="Try the link again"
        error
        details={<ErrorDetails reference={error.requestId} />}
        action={
          <Action
            label="Try again"
            tone="primary"
            icon="retry"
            onPress={retry}
          />
        }
      />
    </AccountShell>
  );
}

function WorkspaceRedirect({
  workspaceId,
  session,
}: {
  workspaceId: string;
  session: Session;
}) {
  const router = useRouter();
  const search = useAddressSearch();
  const workspace = useResource(
    () => getWorkspace(workspaceId),
    `workspace-permalink:${workspaceId}`,
    true,
    [workspaceResourceScope(workspaceId)],
  );
  const missing =
    workspace.state.status === "error" &&
    (workspace.state.error.reason === "not-found" ||
      workspace.state.error.reason === "permission-denied");
  useEffect(() => {
    if (missing) router.replace(dashboardPath);
    if (workspace.state.status === "ready") {
      replaceAddress(
        router,
        workspacePath(workspace.state.value.slug) + search,
      );
    }
  }, [missing, workspace.state, router, search]);
  return (
    <RedirectState
      session={session}
      error={
        workspace.state.status === "error" && !missing
          ? workspace.state.error
          : undefined
      }
      retry={workspace.reload}
    />
  );
}

/** Resolve a durable workspace UUID to its current slug. */
export function WorkspacePermalinkRoute({
  workspaceId,
}: {
  workspaceId: string;
}) {
  return (
    <RequireSession waiting={<PermalinkWait identity={{ kind: "waiting" }} />}>
      {(session) => (
        <WorkspaceRedirect workspaceId={workspaceId} session={session} />
      )}
    </RequireSession>
  );
}

function ProjectRedirect({
  projectId,
  session,
}: {
  projectId: string;
  session: Session;
}) {
  const router = useRouter();
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const project = useResource(
    () => getProject(projectId),
    `project-permalink:${projectId}`,
    true,
    (value) => [
      workspaceResourceScope(value.workspaceId),
      projectResourceScope(value.id),
    ],
  );
  const missing =
    project.state.status === "error" &&
    (project.state.error.reason === "not-found" ||
      project.state.error.reason === "permission-denied");
  useEffect(() => {
    if (missing) router.replace(dashboardPath);
    if (project.state.status === "ready") {
      replaceAddress(
        router,
        canonicalProjectPermalink(pathname, search, project.state.value),
      );
    }
  }, [missing, pathname, project.state, router, search]);
  return (
    <RedirectState
      session={session}
      error={
        project.state.status === "error" && !missing
          ? project.state.error
          : undefined
      }
      retry={project.reload}
    />
  );
}

/** Resolve a project UUID and any legacy tail to the current slug address. */
export function ProjectPermalinkRoute({ projectId }: { projectId: string }) {
  return (
    <RequireSession waiting={<PermalinkWait identity={{ kind: "waiting" }} />}>
      {(session) => <ProjectRedirect projectId={projectId} session={session} />}
    </RequireSession>
  );
}
