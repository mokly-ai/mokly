import { SkeletonBar } from "@firna/ui/skeleton";
import type { ReactNode } from "react";

import { githubAccountsLabel } from "../../api/labels";
import type { Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { listInstallations } from "../../data/installations";
import { workspaceResourceScope } from "../../data/resource-invalidation";
import { useResource } from "../../data/use-resource";

/**
 * What the GitHub accounts fact reads: the names of the accounts the
 * workspace connects, a suspended one saying so, or "None". A suspension is a
 * state of an installation rather than a failure of this pane, and the
 * accounts are the GitHub accounts pane's to act on, so the fact names them
 * and nothing more; `manage` is the quiet way to that pane, for the readers
 * who can act there. Every member reads the names, because the fact follows
 * workspace-read access.
 *
 * The names come from the installation list, a read of its own, so the fact
 * holds its place while the list loads and offers that read again if it
 * fails, without taking the rest of the pane with it.
 */
export function GitHubAccountsFact({
  workspace,
  manage,
}: {
  workspace: Workspace;
  manage?: ReactNode;
}) {
  const installations = useResource(
    () => listInstallations(workspace.id),
    "installations:" + workspace.id,
    true,
    [workspaceResourceScope(workspace.id)],
  );
  const state = installations.state;
  return (
    <span className="review-inline" data-testid="github-accounts-fact">
      {state.status === "loading" && (
        <>
          <span className="fo-sr-only">Loading GitHub accounts</span>
          <SkeletonBar width={96} height={14} />
        </>
      )}
      {state.status === "error" && (
        <>
          Couldn’t load
          <Action
            label="Try again"
            tone="quiet"
            size="sm"
            icon="retry"
            onPress={installations.reload}
          />
        </>
      )}
      {state.status === "ready" && githubAccountsLabel(state.value)}
      {manage}
    </span>
  );
}

/**
 * The fact while the settings scope loads: the names' placeholder that the
 * fact's own read draws, and `manage` in its waiting form. The read has not
 * started, so the scope's wait names what the region waits for.
 */
export function GitHubAccountsFactWait({ manage }: { manage: ReactNode }) {
  return (
    <span className="review-inline">
      <SkeletonBar width={96} height={14} />
      {manage}
    </span>
  );
}
