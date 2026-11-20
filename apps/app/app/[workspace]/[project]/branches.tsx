import { useLocalSearchParams } from "expo-router";

import { ProjectViewerRoute } from "../../../src/screens/app/viewer-route";

/** A branch alias; its name stays in the query because it may contain `/`. */
export default function BranchViewer() {
  const { workspace, project, branch } = useLocalSearchParams<{
    workspace: string;
    project: string;
    branch?: string;
  }>();
  return (
    <ProjectViewerRoute
      workspaceSlug={workspace}
      projectSlug={project}
      branch={branch}
    />
  );
}
