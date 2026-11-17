import { CliFormScreen, CliFormWait } from "../account/cli-form-screen";

import { WorkspaceRoute } from "./workspace-route";

/**
 * The CLI form, resolved against the workspace it creates in. The session
 * read and the workspace read draw the form's own wait, whose way back is the
 * repository step of the workspace the address names.
 */
export function CliProjectRoute({ workspaceSlug }: { workspaceSlug: string }) {
  return (
    <WorkspaceRoute
      workspaceSlug={workspaceSlug}
      title="Publish with the CLI"
      waiting={(identity) => (
        <CliFormWait identity={identity} workspaceSlug={workspaceSlug} />
      )}
    >
      {({ session, workspace }) => (
        <CliFormScreen user={session.user} workspace={workspace} />
      )}
    </WorkspaceRoute>
  );
}
