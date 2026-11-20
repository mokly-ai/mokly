import { useLocalSearchParams } from "expo-router";

import { ProjectViewerRoute } from "../../../../src/screens/app/viewer-route";

/** One immutable publication in its project's viewer. */
export default function PublicationViewer() {
  const { workspace, project, publicationId } = useLocalSearchParams<{
    workspace: string;
    project: string;
    publicationId: string;
  }>();
  return (
    <ProjectViewerRoute
      workspaceSlug={workspace}
      projectSlug={project}
      publicationId={publicationId}
    />
  );
}
