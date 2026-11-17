import {
  ProjectCreatedScreen,
  ProjectCreatedWait,
} from "../account/project-created-screen";
import { ProjectRoute } from "./project-route";

/**
 * The finished project: what it publishes, and the way into its viewer. The
 * session read and the project read draw the screen's own wait.
 */
export function ProjectSetupRoute({
  workspaceSlug,
  projectSlug,
}: {
  workspaceSlug: string;
  projectSlug: string;
}) {
  return (
    <ProjectRoute
      workspaceSlug={workspaceSlug}
      projectSlug={projectSlug}
      title="Project setup"
      waiting={(identity) => <ProjectCreatedWait identity={identity} />}
    >
      {({ session, project }) => (
        <ProjectCreatedScreen user={session.user} project={project} />
      )}
    </ProjectRoute>
  );
}
