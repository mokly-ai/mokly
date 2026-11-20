import { useLocalSearchParams } from "expo-router";

import { ProjectViewerRoute } from "../../../../src/screens/app/viewer-route";

/** One cloud build's details, in its project's viewer stage. */
export default function BuildViewer() {
  const { workspace, project, buildId } = useLocalSearchParams<{
    workspace: string;
    project: string;
    buildId: string;
  }>();
  return (
    <ProjectViewerRoute
      workspaceSlug={workspace}
      projectSlug={project}
      buildId={buildId}
    />
  );
}
