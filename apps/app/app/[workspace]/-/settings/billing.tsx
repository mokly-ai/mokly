import { useLocalSearchParams } from "expo-router";

import { SettingsRoute } from "../../../../src/settings/layer-screen";

/** The billing pane as a durable workspace-slug route. */
export default function BillingSettings() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <SettingsRoute pane="billing" workspaceSlug={workspace} />;
}
