import {
  ChooseRepositoryScreen,
  ChooseRepositoryWait,
} from "../account/choose-repository-screen";

import { WorkspaceRoute } from "./workspace-route";

/**
 * The repository step, resolved against the workspace it creates in. The
 * session read and the workspace read draw the step's own wait.
 */
export function NewProjectRoute({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <WorkspaceRoute
      workspaceSlug={workspaceSlug}
      title="Choose a repository"
      waiting={(identity) => <ChooseRepositoryWait identity={identity} />}
    >
      {({ session, workspace }) => (
        <ChooseRepositoryScreen user={session.user} workspace={workspace} />
      )}
    </WorkspaceRoute>
  );
}
