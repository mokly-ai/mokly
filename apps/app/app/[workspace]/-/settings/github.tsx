import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The GitHub accounts pane as a durable workspace-slug route. */
export default function GitHubSettings() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <SettingsRoute pane="github" workspaceSlug={workspace} />;
}
