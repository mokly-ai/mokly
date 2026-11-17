import { useRouter } from "expo-router";
import { useEffect } from "react";
import type { ReactNode } from "react";

import type { Project, Session } from "../../api/types";
import { Action } from "../../components/action";
import { ErrorDetails } from "../../components/error-details";
import { StateMessage } from "../../components/page-parts";
import { getProjectBySlug } from "../../data/projects";
import {
  workspaceResourceScope,
  projectResourceScope,
} from "../../data/resource-invalidation";
import { useResource } from "../../data/use-resource";
import {
  replaceAddress,
  useAddressPathname,
  useAddressSearch,
} from "../../navigation/address";
import { canonicalProjectAddress } from "../../navigation/canonical";
import { dashboardPath } from "../../navigation/paths";
import { RequireSession } from "../../session/guard";
import { AccountShell } from "../account/account-shell";
import type { WaitingIdentity } from "../account/account-shell";

interface ProjectRouteInput {
  workspaceSlug: string;
  projectSlug: string;
  /** The heading over a project read that failed. */
  title: string;
  /**
   * The destination's waiting layout, which the session read, the project
   * read and the replacement of a moved project's address all draw, for the
   * identity the header draws then. A missing project draws it too, until the
   * reader is sent to `/dashboard`.
   */
  waiting: (identity: WaitingIdentity) => ReactNode;
  children: (input: { session: Session; project: Project }) => ReactNode;
}

function Resolved({
  workspaceSlug,
  projectSlug,
  session,
  title,
  waiting,
  children,
}: ProjectRouteInput & { session: Session }) {
  const router = useRouter();
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const project = useResource(
    () => getProjectBySlug(workspaceSlug, projectSlug),
    `project-slug:${workspaceSlug}:${projectSlug}`,
    true,
    (value) => [
      workspaceResourceScope(value.workspaceId),
      projectResourceScope(value.id),
    ],
  );
  const unauthorized =
    project.state.status === "error" &&
    (project.state.error.reason === "not-found" ||
      project.state.error.reason === "permission-denied");
  const moved =
    project.state.status === "ready" &&
    (project.state.value.canonicalWorkspaceSlug !== workspaceSlug ||
      project.state.value.canonicalSlug !== projectSlug);
  const shownError =
    project.state.status === "error" && !unauthorized
      ? project.state.error
      : undefined;

  useEffect(() => {
    if (unauthorized) router.replace(dashboardPath);
  }, [unauthorized, router]);

  useEffect(() => {
    if (project.state.status !== "ready" || !moved) return;
    replaceAddress(
      router,
      canonicalProjectAddress(
        pathname,
        search,
        project.state.value.canonicalWorkspaceSlug,
        project.state.value.canonicalSlug,
      ),
    );
  }, [moved, pathname, project.state, router, search]);

  if (project.state.status === "ready" && !moved) {
    return <>{children({ session, project: project.state.value })}</>;
  }
  if (!shownError) {
    return <>{waiting({ kind: "signed-in", user: session.user })}</>;
  }
  return (
    <AccountShell
      screen="app-project"
      title={title}
      identity={{ kind: "signed-in", user: session.user }}
    >
      <StateMessage
        title="This project couldn’t load"
        error
        details={<ErrorDetails reference={shownError.requestId} />}
        action={
          <Action
            label="Try again"
            tone="primary"
            icon="retry"
            onPress={project.reload}
          />
        }
      />
    </AccountShell>
  );
}

/** Resolve one project slug route before rendering its terminal screen. */
export function ProjectRoute(input: ProjectRouteInput) {
  return (
    <RequireSession waiting={input.waiting({ kind: "waiting" })}>
      {(session) => <Resolved {...input} session={session} />}
    </RequireSession>
  );
}
