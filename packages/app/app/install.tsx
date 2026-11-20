import { useLocalSearchParams } from "expo-router";

import { InstallRoute } from "../src/screens/app/install-route";

/**
 * The second setup step: install the GitHub App for one workspace, or, with
 * `installationId`, connect an installation that arrived from GitHub.
 */
export default function Install() {
  const { workspaceId, installationId } = useLocalSearchParams<{
    workspaceId?: string;
    installationId?: string;
  }>();
  return (
    <InstallRoute
      workspaceId={typeof workspaceId === "string" ? workspaceId : undefined}
      installationId={
        typeof installationId === "string" ? installationId : undefined
      }
    />
  );
}
