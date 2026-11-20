import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The project pane as a durable slug route. */
export default function ProjectSettings() {
  const { workspace, project } = useLocalSearchParams<{
    workspace: string;
    project: string;
  }>();
  return (
    <SettingsRoute
      pane="project"
      workspaceSlug={workspace}
      projectSlug={project}
    />
  );
}
