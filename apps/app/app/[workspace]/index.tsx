import { useLocalSearchParams } from "expo-router";

import { WorkspaceHomeRedirect } from "../../src/screens/app/home-redirect";

/** Resolve one workspace to its last opened or first project. */
export default function WorkspaceHome() {
  const { workspace } = useLocalSearchParams<{ workspace: string }>();
  return <WorkspaceHomeRedirect workspaceSlug={workspace} />;
}
