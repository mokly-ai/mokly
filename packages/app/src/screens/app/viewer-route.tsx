import type { Project, PullRequest, Session } from "../../api/types";
import type { PublicationRef } from "../../data/publications";
import { everyPullRequest } from "../../data/publications";
import {
  workspaceResourceScope,
  projectResourceScope,
} from "../../data/resource-invalidation";
import { useResource } from "../../data/use-resource";
import { getWorkspace } from "../../data/workspaces";
import { ViewerFrameWait } from "../viewer/frame-wait";
import { ViewerScreen } from "../viewer/viewer-screen";

import { ProjectRoute } from "./project-route";

/** What the address named, before the viewer resolves it to a publication. */
export interface ViewerEntryAddress {
  workspaceSlug: string;
  projectSlug: string;
  publicationId?: string;
  /** A branch alias; branch names can contain slashes, so they are query values. */
  branch?: string;
  /** A pull request alias, which also supplies its title, author and link. */
  pullRequestNumber?: number;
  /** One build's details, which name no publication. */
  buildId?: string;
}

function refFor(address: ViewerEntryAddress): PublicationRef | undefined {
  if (address.pullRequestNumber !== undefined) {
    return { kind: "pull-request", number: address.pullRequestNumber };
  }
  return address.branch !== undefined
    ? { kind: "branch", name: address.branch }
    : undefined;
}

/**
 * The chrome names the workspace beside the project and, on a pull request
 * entry, the pull request itself. Both are read from the API. The project owns
 * the private-publishing capability; the workspace read decides only
 * whether an owner gets the Billing action when that capability is absent.
 * The project response's workspace slug remains the chrome fallback for a
 * direct project guest who cannot read workspace metadata. The entry reads
 * a pull request's row from the same list, so the route lists it once.
 */
function Viewer({
  session,
  project,
  address,
}: {
  session: Session;
  project: Project;
  address: ViewerEntryAddress;
}) {
  const workspace = useResource(
    () => getWorkspace(project.workspaceId),
    "viewer-workspace:" + project.workspaceId,
    true,
    [workspaceResourceScope(project.workspaceId)],
  );
  const number = address.pullRequestNumber;
  const pulls = useResource(
    () => everyPullRequest(project.id),
    "viewer-pulls:" + project.id,
    number !== undefined,
    [projectResourceScope(project.id)],
  );
  const pullRequest: PullRequest | undefined =
    number !== undefined && pulls.state.status === "ready"
      ? pulls.state.value.items.find((entry) => entry.number === number)
      : undefined;
  return (
    <ViewerScreen
      session={session}
      project={project}
      workspace={workspace.state}
      onRetryWorkspace={workspace.reload}
      publicationId={address.publicationId}
      publicationRef={refFor(address)}
      pullRequest={pullRequest}
      pullRequests={number !== undefined ? pulls.state : undefined}
      buildId={address.buildId}
    />
  );
}

/**
 * The viewer route: the project, then the stage the reader works on. The
 * session read and the project read both wait in the cloud frame, which names
 * the read for screen readers.
 */
export function ProjectViewerRoute(address: ViewerEntryAddress) {
  return (
    <ProjectRoute
      workspaceSlug={address.workspaceSlug}
      projectSlug={address.projectSlug}
      title="Opening your project"
      waiting={(identity) => (
        <ViewerFrameWait wait="Opening your project" identity={identity} />
      )}
    >
      {({ session, project }) => (
        <Viewer session={session} project={project} address={address} />
      )}
    </ProjectRoute>
  );
}
