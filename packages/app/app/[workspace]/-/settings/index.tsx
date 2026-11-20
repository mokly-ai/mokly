import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The workspace pane as a durable slug route. */
export default function WorkspaceSettings() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <SettingsRoute pane="workspace" workspaceSlug={workspace} />;
}
