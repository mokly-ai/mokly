import { useLocalSearchParams } from "expo-router";

import { ProjectViewerRoute } from "../../../src/screens/app/viewer-route";

/** The project's canonical viewer route. */
export default function ProjectViewer() {
  const { workspace, project } = useLocalSearchParams<{
    workspace: string;
    project: string;
  }>();
  return <ProjectViewerRoute workspaceSlug={workspace} projectSlug={project} />;
}
