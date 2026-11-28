import { useRouter } from "expo-router";

import type { Workspace, Project } from "../../api/types";
import { site } from "../../config";
import type { PublicationRef } from "../../data/publications";
import {
  workspaceNewProjectPath,
  projectPath,
  settingsPath,
} from "../../navigation/paths";
import type { ViewerSelection } from "../../viewer/host";
import { ViewerPanel } from "../../viewer/panel";
import { HistoryPanel } from "../../viewer/panels/history";
import { ProjectsPanel } from "../../viewer/panels/projects";
import { SharePanel } from "../../viewer/panels/share";
import { SwitcherPanel } from "../../viewer/panels/switcher";
import type { SelectionDefaults, PanelId } from "../../viewer/selection";

/** Everything the open panel needs; the viewer screen owns all of it. */
export interface PanelInput {
  panel: PanelId;
  project: Project;
  workspaceId: string;
  publicationId?: string;
  /** The build the stage shows, which history marks as the current entry. */
  buildId?: string;
  publicationRef?: PublicationRef;
  refLabel?: string;
  selection: ViewerSelection;
  defaults: SelectionDefaults;
  comparable: boolean;
  onClose: () => void;
  onFollow: (href: string) => void;
  /** Reach the switcher, which is the recovery every empty panel offers. */
  onChoose: () => void;
  onSelectScreen: (screen?: string) => void;
}

const titles: Record<PanelId, string> = {
  projects: "Projects",
  switcher: "Branches and pull requests",
  history: "Publication history",
  share: "Share",
};

/**
 * The one overlay a viewer slot opens.
 *
 * Every panel is total over the states the route can be in: a panel open with
 * nothing to show is not expressible, because each panel owns its own empty
 * state rather than the host guarding whether to draw it at all.
 *
 * It is the document's subject while it is open: the viewer beneath is inert
 * and keeps no landmark, exactly as the settings dialog is hosted, and Back or
 * Close dismisses it without changing the publication the stage is showing.
 */
export function ViewerPanelHost(input: PanelInput) {
  const { panel, project } = input;
  const router = useRouter();
  // Setting up publishing is an administrator's action, so only an
  // administrator is offered it.
  const setUpPublishing = project.canAdmin ? site.publishFromCi : undefined;
  const onWorkspaceSettings = (workspace: Workspace) =>
    router.push(
      settingsPath({
        pane: "workspace",
        workspaceSlug: workspace.slug,
      }),
    );
  return (
    <ViewerPanel
      id={panel}
      title={titles[panel]}
      subtitle={panel === "history" ? input.refLabel : undefined}
      onClose={input.onClose}
    >
      {panel === "projects" && (
        <ProjectsPanel
          workspaceId={input.workspaceId}
          currentProjectId={project.id}
          onOpenProject={(next) =>
            input.onFollow(projectPath(next.workspaceSlug, next.slug))
          }
          onWorkspaceSettings={onWorkspaceSettings}
          onCreateProject={() =>
            input.onFollow(workspaceNewProjectPath(project.workspaceSlug))
          }
        />
      )}
      {panel === "switcher" && (
        <SwitcherPanel
          projectId={project.id}
          workspaceSlug={project.workspaceSlug}
          projectSlug={project.slug}
          current={input.publicationRef}
          onFollow={input.onFollow}
          setUpPublishing={setUpPublishing}
        />
      )}
      {panel === "history" && (
        <HistoryPanel
          projectId={project.id}
          workspaceSlug={project.workspaceSlug}
          projectSlug={project.slug}
          currentId={input.publicationId}
          currentBuildId={input.buildId}
          refLabel={input.refLabel}
          publicationRef={input.publicationRef}
          onFollow={input.onFollow}
          onChoose={input.onChoose}
        />
      )}
      {panel === "share" && (
        <SharePanel
          projectId={project.id}
          publicationId={input.publicationId}
          visibility={project.visibility}
          selection={input.selection}
          defaults={input.defaults}
          comparable={input.comparable}
          onSelectScreen={input.onSelectScreen}
          setUpPublishing={setUpPublishing}
        />
      )}
    </ViewerPanel>
  );
}
