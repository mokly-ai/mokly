import { parseInstallationId } from "../../navigation/installation-id";
import { RequireSession } from "../../session/guard";
import { ConnectScreen, ConnectWait } from "../account/connect-screen";
import { InstallScreen, InstallWait } from "../account/install-screen";
import { WorkspaceRoute } from "./workspace-route";

/**
 * The install step. An address that names an installation is the connect
 * situation, which needs a signed-in reader but no workspace yet: choosing
 * one is what it asks. Every other address is resolved against the workspace
 * it installs for. An `installationId` that is not an id names nothing, so it
 * is read as absent. Each read the route makes draws its screen's own wait.
 */
export function InstallRoute({
  workspaceId,
  installationId,
}: {
  workspaceId?: string;
  installationId?: string;
}) {
  const candidate = parseInstallationId(installationId);
  if (candidate !== undefined) {
    return (
      <RequireSession waiting={<ConnectWait identity={{ kind: "waiting" }} />}>
        {(session) => (
          <ConnectScreen
            user={session.user}
            installationId={candidate}
            workspaceId={workspaceId}
          />
        )}
      </RequireSession>
    );
  }
  return (
    <WorkspaceRoute
      workspaceId={workspaceId}
      title="Install the Mokly app"
      waiting={(identity) => <InstallWait identity={identity} />}
    >
      {({ session, workspace }) => (
        <InstallScreen user={session.user} workspace={workspace} />
      )}
    </WorkspaceRoute>
  );
}
