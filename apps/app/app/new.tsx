import { useLocalSearchParams } from "expo-router";

import {
  CreateWorkspaceScreen,
  CreateWorkspaceWait,
} from "../src/screens/account/create-workspace-screen";
import { parseInstallationId } from "../src/navigation/installation-id";
import { RequireSession } from "../src/session/guard";

/**
 * The first setup step: a personal workspace. An installation that arrived
 * from GitHub for a reader with no workspace to put it in rides along, so the
 * install step after it connects that installation. While the session read
 * runs, the step draws its own form in waiting form.
 */
export default function NewWorkspace() {
  const { installationId } = useLocalSearchParams<{
    installationId?: string;
  }>();
  return (
    <RequireSession waiting={<CreateWorkspaceWait />}>
      {(session) => (
        <CreateWorkspaceScreen
          user={session.user}
          installationId={parseInstallationId(
            typeof installationId === "string" ? installationId : undefined,
          )}
        />
      )}
    </RequireSession>
  );
}
