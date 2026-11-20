import { useCallback } from "react";
import type { ReactNode } from "react";

import { planLabel, roleLabel } from "../../api/labels";
import type { Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { formFailure } from "../../components/form-failure";
import { Facts } from "../../components/page-parts";
import {
  ControlPlaceholder,
  factPlaceholder,
  TextBar,
} from "../../components/placeholders";
import { renameWorkspace } from "../../data/workspaces";
import { canonicalWorkspaceWorkingRoute } from "../../navigation/canonical";
import { workspacePath } from "../../navigation/paths";
import { useSettings } from "../context";
import { useDraft } from "../dirty";
import { draftKey } from "../drafts";
import { PaneLink } from "../pane-link";
import { useWrite } from "../write";

import { SlugEditor } from "./slug-editor";
import { GitHubAccountsFact, GitHubAccountsFactWait } from "./workspace-github";
import {
  Projects,
  ProjectsSection,
  ProjectsTableWait,
} from "./workspace-projects";

/** The widths in px of the pane's controls whose presence the role decides. */
const changeWidth = 72;
const manageWidth = 73;
const saveWidth = 123;

/**
 * The Workspace pane's layout, which the pane and its wait both draw: the
 * name, the workspace's facts and Save, then its projects.
 */
function WorkspaceLayout({
  name,
  facts,
  save,
  projects,
}: {
  name: ReactNode;
  facts: readonly (readonly [string, ReactNode])[];
  save: ReactNode;
  projects: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <section className="fo-section fo-section-flush">
        <div className="fo-form">
          {name}
          <Facts rows={facts} />
          {save}
        </div>
      </section>
      {projects}
    </div>
  );
}

/** Name, plan, address, GitHub accounts and the workspace's projects. */
export function WorkspacePane({ workspace }: { workspace: Workspace }) {
  const { reload, paneView, openPaneView } = useSettings();
  const [name, setName] = useDraft(
    draftKey("workspace", workspace.id, "name"),
    workspace.name,
  );
  const renaming = useWrite(
    reload,
    name.trim().length > 0 && name.trim() !== workspace.name,
  );
  const administers = workspace.role === "owner" || workspace.role === "admin";

  const save = useCallback(
    () =>
      renaming.run(() =>
        renameWorkspace(workspace.id, {
          name: name.trim(),
          slug: workspace.slug,
          version: workspace.version,
        }),
      ),
    [name, workspace.id, workspace.slug, workspace.version, renaming],
  );

  const failure = formFailure(renaming, { "validation-failed": "name" });
  if (paneView?.id === "slug" && paneView.pane === "workspace") {
    return (
      <SlugEditor
        subject="workspace"
        subjectId={workspace.id}
        current={workspace.slug}
        address={workspacePath}
        save={(slug) =>
          renameWorkspace(workspace.id, {
            name: workspace.name,
            slug,
            version: workspace.version,
          })
        }
        canonicalAddress={(pathname, search, saved) =>
          canonicalWorkspaceWorkingRoute(
            pathname,
            search,
            workspace.slug,
            saved.slug,
          )
        }
      />
    );
  }
  return (
    <WorkspaceLayout
      name={
        <Field
          label="Workspace name"
          name="workspace-name"
          type="text"
          value={name}
          onChange={setName}
          disabled={renaming.working || !administers}
          error={failure.on("name")}
        />
      }
      facts={[
        // Every member reads the plan here, including the ones the Billing
        // pane is not shown to.
        ["Plan", planLabel(workspace.plan)],
        [
          "Slug",
          <span className="review-inline" key="workspace-slug">
            <code>{workspace.slug}</code>
            {administers && (
              <Action
                label="Change"
                tone="quiet"
                size="sm"
                onPress={() =>
                  openPaneView({
                    id: "slug",
                    pane: "workspace",
                    title: "Workspace address",
                  })
                }
                testID="change-workspace-slug"
              />
            )}
          </span>,
        ],
        [
          "GitHub accounts",
          <GitHubAccountsFact
            key="github-accounts"
            workspace={workspace}
            manage={
              administers ? (
                <PaneLink label="Manage" to="github" tone="quiet" />
              ) : undefined
            }
          />,
        ],
        ["Your role", roleLabel(workspace.role)],
      ]}
      save={
        administers &&
        failure.around(
          <div className="review-inline">
            <Action
              label={failure.label("Save changes", "Saving…")}
              tone="primary"
              size="md"
              write={renaming}
              operation="Saving settings"
              onPress={() => void save()}
              testID="save-workspace"
            />
          </div>,
        )
      }
      projects={<Projects workspace={workspace} />}
    />
  );
}

/**
 * The pane while the settings scope loads. Every text that the workspace
 * supplies waits as a bar in its own line box, and the field waits in its
 * frame. Change, Manage and Save show for the readers who administer the
 * workspace, the most common form, as placeholders in their own boxes; the
 * projects list draws its one placeholder row, under Create project, which
 * draws itself, disabled.
 */
export function WorkspaceWait() {
  return (
    <WorkspaceLayout
      name={
        <Field
          label="Workspace name"
          name="workspace-name"
          type="text"
          waiting
        />
      }
      facts={[
        factPlaceholder("Plan", "3em"),
        [
          "Slug",
          <span className="review-inline" key="workspace-slug">
            <code>
              <TextBar width="7em" />
            </code>
            <ControlPlaceholder size="sm" width={changeWidth} />
          </span>,
        ],
        [
          "GitHub accounts",
          <GitHubAccountsFactWait
            key="github-accounts"
            manage={<ControlPlaceholder size="sm" width={manageWidth} />}
          />,
        ],
        factPlaceholder("Your role", "3.5em"),
      ]}
      save={
        <div className="review-inline">
          <ControlPlaceholder size="md" width={saveWidth} />
        </div>
      }
      projects={
        <ProjectsSection
          action={
            <Action label="Create project" size="sm" icon="start" disabled />
          }
        >
          <ProjectsTableWait />
        </ProjectsSection>
      }
    />
  );
}
