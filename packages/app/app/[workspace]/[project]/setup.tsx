import { useLocalSearchParams } from "expo-router";

import { ProjectSetupRoute } from "../../../src/screens/app/project-setup-route";

/** The project-created publishing step. */
export default function ProjectSetup() {
  const { workspace, project } = useLocalSearchParams<{
    workspace: string;
    project: string;
  }>();
  return <ProjectSetupRoute workspaceSlug={workspace} projectSlug={project} />;
}
