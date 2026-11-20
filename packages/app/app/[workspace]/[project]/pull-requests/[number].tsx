import { useLocalSearchParams } from "expo-router";

import { ProjectViewerRoute } from "../../../../src/screens/app/viewer-route";

/** One pull-request alias in its project's viewer. */
export default function PullRequestViewer() {
  const { workspace, project, number } = useLocalSearchParams<{
    workspace: string;
    project: string;
    number: string;
  }>();
  const parsed = Number.parseInt(number ?? "", 10);
  return (
    <ProjectViewerRoute
      workspaceSlug={workspace}
      projectSlug={project}
      pullRequestNumber={
        Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined
      }
    />
  );
}
