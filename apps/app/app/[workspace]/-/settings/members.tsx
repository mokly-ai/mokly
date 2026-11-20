import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The members pane as a durable slug route. */
export default function MemberSettings() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <SettingsRoute pane="members" workspaceSlug={workspace} />;
}
