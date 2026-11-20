import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The publishing-token pane as a durable slug route. */
export default function TokensSettings() {
  const { workspace, project } = useLocalSearchParams<{
    workspace: string;
    project: string;
  }>();
  return (
    <SettingsRoute
      pane="tokens"
      workspaceSlug={workspace}
      projectSlug={project}
    />
  );
}
