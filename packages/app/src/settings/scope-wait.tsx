import type { Session } from "../api/types";
import { Pending } from "../components/page-parts";
import { TextBar } from "../components/placeholders";

import { availablePanes } from "./panes";
import type { PaneDefinition, SurfaceId } from "./panes";
import { AccessWait } from "./panes/access-pane";
import { AccountWait } from "./panes/account-pane";
import { TeamPlanWaiting } from "./panes/billing-plans";
import { DangerWait } from "./panes/danger-pane";
import { GitHubWait } from "./panes/github-pane";
import { MembersWait } from "./panes/members-pane";
import { ProjectWait } from "./panes/project-pane";
import { SectionsWait } from "./panes/sections-pane";
import { TokensWait } from "./panes/tokens-pane";
import { WorkspaceWait } from "./panes/workspace-pane";

/**
 * The panes that the address's scope gives an owner, which a settings surface
 * draws while its scope loads: an owner sees every pane, the workspace's
 * included, and the project's where the address names a project. The answer
 * may give the reader fewer, and the surface then draws those.
 */
export function scopePanes(project: boolean): readonly PaneDefinition[] {
  return availablePanes({ workspace: true, project, role: "owner" });
}

/**
 * One pane's wait while settings loads: the pane's own waiting layout, with
 * each text that the scope supplies, such as the workspace's name, as a bar.
 * Billing's read has not started, so its Plan value is a bar too. `session`
 * is nothing while the session read runs, and the Account pane then draws
 * the session's texts in their placeholder forms as well.
 */
function PaneWait({
  pane,
  panes,
  session,
}: {
  pane: SurfaceId;
  panes: readonly PaneDefinition[];
  session: Session | undefined;
}) {
  switch (pane) {
    case "sections":
      return <SectionsWait panes={panes} />;
    case "account":
      return <AccountWait session={session} />;
    case "workspace":
      return <WorkspaceWait />;
    case "github":
      return <GitHubWait />;
    case "members":
      return <MembersWait />;
    case "billing":
      return <TeamPlanWaiting plan={<TextBar width="4em" />} />;
    case "project":
      return <ProjectWait />;
    case "tokens":
      return <TokensWait />;
    case "access":
      return <AccessWait />;
    case "danger":
      return <DangerWait />;
  }
}

/**
 * What the dialog and the full-screen layer draw in the pane's place while
 * settings loads, which is the session read and then the settings scope: the
 * wait of the pane the address asks for, or of the index, drawn with `panes`,
 * the panes the scope gives an owner. `session` is nothing while the session
 * read runs. No text place of the pane is either read's own, so the wait is
 * named for screen readers only.
 */
export function ScopeWait({
  pane,
  panes,
  session,
}: {
  pane: SurfaceId;
  panes: readonly PaneDefinition[];
  session: Session | undefined;
}) {
  return (
    <Pending label="Loading settings" labelMode="screen-reader-only">
      <PaneWait pane={pane} panes={panes} session={session} />
    </Pending>
  );
}
