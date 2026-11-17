import { SkeletonBar } from "@firna/ui/skeleton";

import { githubAccounts, workspace } from "../../../fixtures/product";
import { Action } from "../page-parts";
import { ControlPlaceholder } from "../placeholders";
import type { Installation } from "../setup-destinations";
import type { Role } from "./workspace-projects";

/** The width of Manage at the fact's action size, in px. */
const manageWidth = 73;

/** How far the fact's own read of the installation list has got. */
export type AccountsRead = "read" | "loading" | "failed";

/**
 * What the GitHub accounts fact reads: the account names the workspace
 * connects, a suspended one saying so, or "None". A suspension is a state of
 * an installation rather than a failure of this pane, and the accounts are the
 * GitHub accounts pane's to act on, so the fact names them and nothing more.
 */
function accountsValue(installation: Installation): string {
  if (installation === "absent") return "None";
  if (installation === "suspended")
    return githubAccounts[0].name + " · " + workspace.installationSuspended;
  if (installation === "connected")
    return githubAccounts.map((account) => account.name).join(", ");
  // A fourth state the read model gains is a state this drawing has no words
  // for; falling through would draw it as one of the three above. Fail here.
  return unreadable(installation);
}

/** The state nothing above knows how to draw, refused at compile time. */
function unreadable(installation: never): never {
  throw new Error("unknown installation: " + String(installation));
}

/**
 * The fact and, for the readers who can act on the accounts, the quiet way to
 * the pane that holds them. Every member reads the names and a suspension.
 * The names come from a read of their own, so the fact holds its place while
 * that read runs and offers it again if it fails, without taking the rest of
 * the pane with it.
 */
export function GitHubAccounts({
  installation,
  role,
  read = "read",
}: {
  installation: Installation;
  role: Role;
  read?: AccountsRead;
}) {
  return (
    <span className="review-inline">
      {read === "loading" && (
        <>
          <span className="fo-sr-only">Loading GitHub accounts</span>
          <SkeletonBar width={96} height={14} />
        </>
      )}
      {read === "failed" && (
        <>
          <span>Couldn’t load</span>
          <Action
            label="Try again"
            instance="retry-github-accounts"
            to="product/settings/workspace"
            tone="quiet"
            size="sm"
            icon="retry"
          />
        </>
      )}
      {read === "read" && accountsValue(installation)}
      {role !== "member" && (
        <Action
          label="Manage"
          instance="manage-github-accounts"
          to="product/settings/github"
          tone="quiet"
          size="sm"
        />
      )}
    </span>
  );
}

/**
 * The fact while the settings scope loads: the names' placeholder that the
 * fact's own read draws, and Manage, whose presence the reader's role decides,
 * as a placeholder in its own box. The fact's read has not started, so the
 * scope's wait names what the region waits for.
 */
export function GitHubAccountsWait() {
  return (
    <span className="review-inline">
      <SkeletonBar width={96} height={14} />
      <ControlPlaceholder size="sm" width={manageWidth} />
    </span>
  );
}
