import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The project-access pane as a durable slug route. */
export default function AccessSettings() {
  const { workspace, project } = useLocalSearchParams<{
    workspace: string;
    project: string;
  }>();
  return (
    <SettingsRoute
      pane="access"
      workspaceSlug={workspace}
      projectSlug={project}
    />
  );
}
