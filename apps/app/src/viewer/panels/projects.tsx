import type { ReactNode } from "react";

import type { Workspace, Project } from "../../api/types";
import { Action } from "../../components/action";
import { ContentList } from "../../components/controls";
import { ControlPlaceholder, TextBar } from "../../components/placeholders";
import { PaneResource } from "../../components/resource-state";
import { Pending, StateMessage } from "../../components/page-parts";
import { listInstallations } from "../../data/installations";
import { listProjects } from "../../data/projects";
import { listWorkspaces } from "../../data/workspaces";
import { useResource } from "../../data/use-resource";
import { appAddress } from "../../config";
import { projectPath } from "../../navigation/paths";

/** One workspace the reader can open, with the projects inside it. */
interface WorkspaceProjects {
  workspace: Workspace;
  projects: readonly Project[];
  /** The GitHub accounts the workspace connects, joined for one line. */
  accounts: string;
}

/**
 * The workspaces, their projects, and the GitHub accounts each connects. The
 * accounts are one read across every workspace and only name the group, so a
 * list that could not be read leaves the names out rather than the panel.
 */
async function readWorkspaceProjects(): Promise<WorkspaceProjects[]> {
  const [workspaces, installations] = await Promise.all([
    listWorkspaces(),
    listInstallations().catch(() => []),
  ]);
  return Promise.all(
    workspaces.map(async (workspace) => ({
      workspace,
      projects: await listProjects(workspace.id),
      accounts: installations
        .filter((installation) => installation.workspaceId === workspace.id)
        .map((installation) => installation.account)
        .join(", "),
    })),
  );
}

function administers(workspace: Workspace): boolean {
  return workspace.role === "owner" || workspace.role === "admin";
}

/**
 * One workspace group: its name and the GitHub accounts it connects, its
 * projects, and Workspace settings for an administrator. The loaded panel and
 * its wait both draw it, each passing its own parts, as the catalogue's
 * `WorkspaceGroup` does.
 */
function WorkspaceGroup({
  name,
  accounts,
  projects,
  settings,
}: {
  name: ReactNode;
  /** The accounts the workspace connects; empty when it connects none. */
  accounts: ReactNode;
  projects: ReactNode;
  /** Workspace settings, for a workspace the reader administers. */
  settings?: ReactNode;
}) {
  return (
    <section className="fo-ref-group">
      <div className="fo-ref-head">
        <span className="fo-ref-name">{name}</span>
        {accounts && <span className="fo-ref-detail">{accounts}</span>}
      </div>
      {projects}
      {settings !== undefined && (
        <div className="fo-panel-foot">{settings}</div>
      )}
    </section>
  );
}

function Workspaces({
  groups,
  currentProjectId,
  onOpenProject,
  onWorkspaceSettings,
}: {
  groups: readonly WorkspaceProjects[];
  currentProjectId: string;
  onOpenProject: (project: Project) => void;
  onWorkspaceSettings: (workspace: Workspace) => void;
}) {
  return (
    <>
      {groups.map(({ workspace, projects, accounts }) => (
        <WorkspaceGroup
          key={workspace.id}
          name={workspace.name}
          accounts={accounts}
          projects={
            projects.length === 0 ? (
              <p className="fo-copy">No projects here yet.</p>
            ) : (
              <ContentList
                label={workspace.name + " projects"}
                rows={projects.map((project) => ({
                  id: project.id,
                  title: project.name,
                  detail: appAddress(
                    projectPath(project.workspaceSlug, project.slug),
                  ),
                  ...(project.id === currentProjectId
                    ? { meta: "Current" }
                    : {
                        href: projectPath(project.workspaceSlug, project.slug),
                        action: "Open",
                        onFollow: () => onOpenProject(project),
                      }),
                }))}
              />
            )
          }
          settings={
            administers(workspace) ? (
              <Action
                label="Workspace settings"
                tone="quiet"
                size="sm"
                onPress={() => onWorkspaceSettings(workspace)}
                testID={"workspace-settings-" + workspace.id}
              />
            ) : undefined
          }
        />
      ))}
    </>
  );
}

/** The width of Workspace settings at the panel foot's size, in px. */
const workspaceSettingsWidth = 143;

/**
 * One workspace group while the panel's read runs. The workspace's name and
 * the accounts it connects are the read's, so each is a bar in its own line.
 * The projects list draws one placeholder row in the row's own frame, and
 * Workspace settings, which only an administrator is offered, is a
 * placeholder over its own box. The person who creates a workspace owns it,
 * so the wait draws an administrator's form, which connects an account.
 */
function WaitingWorkspace() {
  return (
    <WorkspaceGroup
      name={<TextBar width="5em" />}
      accounts={<TextBar width="5em" />}
      projects={
        <ContentList
          label="Projects"
          rows={[
            {
              id: "waiting",
              waiting: true,
              title: "",
              detail: "",
              action: "Open",
            },
          ]}
        />
      }
      settings={<ControlPlaceholder size="sm" width={workspaceSettingsWidth} />}
    />
  );
}

/**
 * The workspaces the reader can reach and the projects inside each one. The
 * product has no workspace page, so this panel is where a workspace is
 * administered from and where the next project is created.
 */
export function ProjectsPanel({
  workspaceId,
  currentProjectId,
  onOpenProject,
  onWorkspaceSettings,
  onCreateProject,
}: {
  workspaceId: string;
  currentProjectId: string;
  onOpenProject: (project: Project) => void;
  onWorkspaceSettings: (workspace: Workspace) => void;
  onCreateProject: (workspaceId: string) => void;
}) {
  const groups = useResource(readWorkspaceProjects, "viewer-projects");
  return (
    <div className="fo-panel-stack">
      <PaneResource
        resource={groups.state}
        waiting={
          // The workspaces are a list too, so one group stands for them. No
          // text place here is the read's, so it is named for screen readers.
          <Pending label="Loading projects" labelMode="screen-reader-only">
            <WaitingWorkspace />
          </Pending>
        }
        failure="Projects couldn’t load"
        onRetry={groups.reload}
      >
        {(items) =>
          items.length === 0 ? (
            <StateMessage title="No workspaces yet" icon="workspace" />
          ) : (
            <Workspaces
              groups={items}
              currentProjectId={currentProjectId}
              onOpenProject={onOpenProject}
              onWorkspaceSettings={onWorkspaceSettings}
            />
          )
        }
      </PaneResource>
      {groups.state.status !== "error" && (
        <div className="fo-panel-foot">
          <Action
            label="Create project"
            tone="primary"
            size="md"
            icon="start"
            disabled={groups.state.status === "loading"}
            onPress={() => onCreateProject(workspaceId)}
            testID="projects-create"
          />
        </div>
      )}
    </div>
  );
}
