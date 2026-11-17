import type { ReactNode } from "react";

import { publicOnFree } from "../../api/labels";
import type { Workspace } from "../../api/types";
import { Action } from "../../components/action";
import { RecordTable } from "../../components/controls";
import { PlanConsequence } from "../../components/plan-consequence";
import { Pending, Section, StateMessage } from "../../components/page-parts";
import { TextBar } from "../../components/placeholders";
import { PaneResource } from "../../components/resource-state";
import { listProjects } from "../../data/projects";
import { useResource } from "../../data/use-resource";
import {
  installStepPath,
  workspaceNewProjectPath,
} from "../../navigation/paths";
import { useSettings } from "../context";

/**
 * Where a new project starts for this workspace: the repository step once
 * the App is installed, and the install step until then, because a project is
 * a repository the App can read and the repository step has nothing to list
 * before that.
 */
function nextStep(workspace: Workspace): {
  label: string;
  route: string;
} {
  return workspace.githubInstallationState === "connected"
    ? {
        label: "Choose a repository",
        route: workspaceNewProjectPath(workspace.slug),
      }
    : {
        label: "Install the Mokly app",
        route: installStepPath(workspace.id),
      };
}

/** The projects table's columns, which its rows and its waiting row share. */
const columns = [
  { key: "name", label: "Project", flex: 1 },
  { key: "repository", label: "Repository", flex: 2 },
] as const;

/**
 * The Projects section, which the pane and its waits both draw: its heading,
 * the action that starts a project, and what the projects read gives.
 */
export function ProjectsSection({
  action,
  children,
}: {
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section title="Projects" action={action}>
      {children}
    </Section>
  );
}

/**
 * The projects list while it is read: one placeholder row in the table's own
 * frame, with a bar in place of each cell's text.
 */
export function ProjectsTableWait() {
  return (
    <div className="fo-panel">
      <RecordTable
        label="Projects"
        columns={columns}
        rows={[
          {
            id: "waiting",
            cells: {
              name: <TextBar width="70%" />,
              repository: <TextBar width="70%" />,
            },
          },
        ]}
      />
    </div>
  );
}

/**
 * What the workspace owns. A workspace with no projects yet is told what
 * its first one will be on the free plan: public. One that has returned to the
 * free plan keeps its projects and its publications, and is told where its
 * private ones stand, with the role-appropriate way on beside the sentence.
 * Only the list waits for the projects read: the heading and Create project
 * are the workspace's, which the pane already has.
 */
export function Projects({ workspace }: { workspace: Workspace }) {
  const { leaveTo } = useSettings();
  const free = workspace.plan === "free";
  const projects = useResource(
    () => listProjects(workspace.id),
    "projects:" + workspace.id,
  );
  const step = nextStep(workspace);
  return (
    <ProjectsSection
      action={
        <Action
          label="Create project"
          size="sm"
          icon="start"
          onPress={() => leaveTo(step.route)}
        />
      }
    >
      <PaneResource
        resource={projects.state}
        waiting={
          <Pending label="Loading projects" labelMode="screen-reader-only">
            <ProjectsTableWait />
          </Pending>
        }
        failure="Projects couldn’t load"
        onRetry={projects.reload}
      >
        {(items) =>
          items.length === 0 ? (
            <>
              <StateMessage
                title="Create your first project"
                icon="project"
                action={
                  <Action
                    label={step.label}
                    tone="primary"
                    size="md"
                    onPress={() => leaveTo(step.route)}
                  />
                }
              />
              {free && <p className="fo-copy">{publicOnFree}</p>}
            </>
          ) : (
            <>
              <div className="fo-panel">
                <RecordTable
                  label="Projects"
                  columns={columns}
                  rows={items.map((project) => ({
                    id: project.id,
                    cells: {
                      name: project.name,
                      repository: project.repository,
                    },
                  }))}
                />
              </div>
              {free &&
                items.some((project) => project.visibility === "private") && (
                  <PlanConsequence
                    sentence="Publishing to private projects is on Team."
                    canUpgrade={workspace.role === "owner"}
                    to="billing"
                  />
                )}
            </>
          )
        }
      </PaneResource>
    </ProjectsSection>
  );
}
