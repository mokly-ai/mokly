import { StateMessage } from "../components/page-parts";
import { useDocumentTitle } from "../layout/document-title";
import { useSettings } from "./context";
import { panes } from "./panes";
import type { SurfaceId } from "./panes";
import { AccessPane } from "./panes/access-pane";
import { AccountPane } from "./panes/account-pane";
import { BillingPane } from "./panes/billing-pane";
import { DangerPane } from "./panes/danger-pane";
import { GitHubPane } from "./panes/github-pane";
import { MembersPane } from "./panes/members-pane";
import { WorkspacePane } from "./panes/workspace-pane";
import { ProjectPane } from "./panes/project-pane";
import { SectionsPane } from "./panes/sections-pane";
import { TokensPane } from "./panes/tokens-pane";

/** The heading one surface carries, which is also the document's single `h1`. */
export function paneTitle(pane: SurfaceId): string {
  if (pane === "sections") return "Settings";
  return panes.find((candidate) => candidate.id === pane)?.title ?? "Settings";
}

/**
 * One pane, whichever frame hosts it. A pane whose scope disappeared says so
 * inside the pane rather than closing the surface the reader opened.
 */
export function PaneView({ pane }: { pane: SurfaceId }) {
  const { workspace, project, paneView } = useSettings();
  useDocumentTitle(paneView?.title ?? paneTitle(pane));
  if (pane === "sections") return <SectionsPane />;
  if (pane === "account") return <AccountPane />;
  if (
    pane === "workspace" ||
    pane === "github" ||
    pane === "members" ||
    pane === "billing"
  ) {
    if (!workspace) {
      return (
        <StateMessage title="Choose a workspace" icon="workspace">
          Open settings from a workspace to manage it.
        </StateMessage>
      );
    }
    if (pane === "workspace") {
      return <WorkspacePane workspace={workspace} />;
    }
    if (pane === "github") return <GitHubPane workspace={workspace} />;
    return pane === "members" ? (
      <MembersPane workspace={workspace} />
    ) : (
      <BillingPane workspace={workspace} project={project} />
    );
  }
  if (!project) {
    return (
      <StateMessage title="Choose a project" icon="project">
        Open settings from a project to manage it.
      </StateMessage>
    );
  }
  if (pane === "project") return <ProjectPane project={project} />;
  if (pane === "tokens") return <TokensPane project={project} />;
  if (pane === "access") return <AccessPane project={project} />;
  return <DangerPane project={project} />;
}
