import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The delete-project pane as a durable slug route. */
export default function DangerSettings() {
  const { workspace, project } = useLocalSearchParams<{
    workspace: string;
    project: string;
  }>();
  return (
    <SettingsRoute
      pane="danger"
      workspaceSlug={workspace}
      projectSlug={project}
    />
  );
}
