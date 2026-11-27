import type { ReactNode } from "react";

import type { Viewport } from "@mokly/mokly";

import { addresses, sample } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { failureReference } from "../../../fixtures/product-states";
import { workspaces } from "../../../fixtures/publications";
import { Action, Pending, StateMessage } from "../page-parts";
import { TextBar } from "../placeholders";
import { MenuTriggerPlaceholder } from "../settings/row-placeholders";

import { PanelList } from "./panel-rows";
import { ViewerPanelScreen } from "./screen";

const title = "Projects";

/**
 * One workspace group: its line, with its name, the GitHub accounts it
 * connects and, for an administrator, the Workspace settings cog at its end,
 * then its projects. The loaded panel and its wait both draw it, each passing
 * its own parts.
 */
function WorkspaceGroup({
  name,
  accounts,
  projects,
  settings,
}: {
  name: ReactNode;
  /** The accounts the workspace connects, when it connects any. */
  accounts?: ReactNode;
  projects: ReactNode;
  /** The Workspace settings cog, for a workspace the reader administers. */
  settings?: ReactNode;
}) {
  return (
    <section className="fo-ref-group">
      <div className="fo-ref-head">
        <span className="fo-ref-name">{name}</span>
        {accounts !== undefined && (
          <span className="fo-ref-detail">{accounts}</span>
        )}
        {settings !== undefined && (
          <span className="fo-ref-head-action">{settings}</span>
        )}
      </div>
      {projects}
    </section>
  );
}

function Workspaces({ state }: { state: ScreenState }) {
  return (
    <>
      {workspaces.map((workspace) => (
        <WorkspaceGroup
          key={workspace.id}
          name={workspace.name}
          accounts={
            workspace.accounts.length > 0
              ? workspace.accounts.join(", ")
              : undefined
          }
          projects={
            state === "empty" && workspace.id === "personal" ? (
              <p className="fo-copy">No projects here yet.</p>
            ) : (
              <PanelList
                label={workspace.name + " projects"}
                rows={workspace.projects.map((project) => ({
                  id: workspace.id + "-" + project.id,
                  title: project.name,
                  detail:
                    addresses.root + "/" + workspace.slug + "/" + project.slug,
                  ...(project.name === sample.project
                    ? { current: true, mark: "Current" }
                    : { to: "product/viewer/standalone", action: "Open" }),
                }))}
              />
            )
          }
          settings={
            workspace.administrator ? (
              <Action
                instance={"workspace-settings-" + workspace.id}
                label="Workspace settings"
                to="product/settings/workspace"
                icon="settings"
                iconOnly
                tone="quiet"
                size="sm"
              />
            ) : undefined
          }
        />
      ))}
    </>
  );
}

/**
 * One workspace group while the panel's read runs. The workspace's name and
 * the accounts it connects are the read's, so each is a bar in its own line,
 * and a bar cannot wrap as words do, so both fit one line of the narrowest
 * panel at twice the text size. The projects list draws one placeholder row
 * in the row's own frame, and the Workspace settings cog, which only an
 * administrator is offered, is a placeholder over its own square box. The person who creates a
 * workspace owns it, so the wait draws an administrator's form, which
 * connects an account.
 */
function WaitingWorkspace() {
  return (
    <WorkspaceGroup
      name={<TextBar width="5em" />}
      accounts={<TextBar width="5em" />}
      projects={
        <PanelList
          label="Projects"
          rows={[
            {
              id: "waiting",
              title: "",
              detail: "",
              to: "product/viewer/standalone",
              action: "Open",
              waiting: true,
            },
          ]}
        />
      }
      settings={<MenuTriggerPlaceholder />}
    />
  );
}

function ProjectsPage({
  state,
  viewport,
}: {
  state: ScreenState;
  viewport: Viewport;
}) {
  return (
    <ViewerPanelScreen
      id="product/viewer/projects"
      state={state}
      viewport={viewport}
      title={title}
      close="product/viewer/standalone"
    >
      <div className="fo-panel-stack">
        {state === "loading" ? (
          // The workspaces are a list too, so one group stands for them. No
          // text place here is the read's, so it is named for screen readers.
          <Pending label="Loading projects" labelMode="screen-reader-only">
            <WaitingWorkspace />
          </Pending>
        ) : state === "error" ? (
          <StateMessage
            title="Projects couldn’t load"
            error
            reference={failureReference}
            action={
              <Action
                instance="projects-retry"
                label="Try again"
                to="product/viewer/projects"
                tone="primary"
                size="md"
                icon="retry"
              />
            }
          />
        ) : (
          <Workspaces state={state} />
        )}
        {state !== "error" && (
          <div className="fo-panel-foot">
            <Action
              instance="projects-create"
              label="Create project"
              to="product/account/choose-repository"
              tone="primary"
              size="md"
              icon="start"
              disabled={state === "loading"}
            />
            <Action
              instance="projects-create-workspace"
              label="Create workspace"
              to="product/account/create-workspace"
              size="md"
              icon="start"
            />
          </div>
        )}
      </div>
    </ViewerPanelScreen>
  );
}

export function ViewerProjectsScreen({ viewport }: { viewport: Viewport }) {
  return <ProjectsPage viewport={viewport} state="default" />;
}

export function ViewerProjectsEmptyScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <ProjectsPage viewport={viewport} state="empty" />;
}

export function ViewerProjectsLoadingScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <ProjectsPage viewport={viewport} state="loading" />;
}

export function ViewerProjectsErrorScreen({
  viewport,
}: {
  viewport: Viewport;
}) {
  return <ProjectsPage viewport={viewport} state="error" />;
}
