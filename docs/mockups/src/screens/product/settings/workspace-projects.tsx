import { Table } from "../../../entries/design/table.mockup";
import { workspace } from "../../../fixtures/product";
import type { ScreenState } from "../../../fixtures/product-states";
import { billing } from "../../../fixtures/product-states";
import { Action, Pending, Section, StateMessage } from "../page-parts";
import { setupStep } from "../setup-destinations";
import type { Installation } from "../setup-destinations";

/** Which plan this drawing reads, which one fact and one sentence report. */
export type Plan = "team" | "free";

/** Who reads the pane: only an owner can open Billing. */
export type Role = "owner" | "admin" | "member";

/**
 * Where a new project starts, named for the step it opens: the repository
 * step once an account is connected, the install step until then. The absent
 * and suspended drawings offer the install step, which also leads to the CLI
 * form.
 */
function nextStep(installation: Installation): { label: string; to: string } {
  return {
    label:
      installation === "connected"
        ? "Choose a repository"
        : "Install the Mokly app",
    to: setupStep(installation),
  };
}

/** The projects table's columns, which its rows and its waiting row share. */
const columns = [
  { key: "name", label: "Project", flex: 1 },
  { key: "repository", label: "Repository", flex: 2 },
];

/** The projects list while it is read: one placeholder row in its own frame. */
function ProjectsTableWait() {
  return (
    <div className="fo-panel">
      <Table
        moklyInstance="workspace-projects"
        label="Projects"
        columns={columns}
        rows={[
          {
            id: "waiting",
            waiting: true,
            cells: [
              { key: "name", value: "" },
              { key: "repository", value: "", muted: true },
            ],
          },
        ]}
      />
    </div>
  );
}

/**
 * What the workspace owns. A workspace with no projects yet is one
 * nobody has created anything in, which is where every workspace starts and
 * therefore on the free plan, so the offer to create the first one says what it
 * will be: public. A workspace that has returned to the free plan keeps its
 * projects and its publications, and is told where its private ones stand.
 * While the settings scope loads, the section is part of the pane's waiting
 * region: Create project, whose label is known, draws itself disabled, and the
 * list draws its one placeholder row before its own read has started.
 */
export function Projects({
  state,
  installation,
  plan,
  role,
  scopeLoading = false,
}: {
  state: ScreenState;
  installation: Installation;
  plan: Plan;
  role: Role;
  scopeLoading?: boolean;
}) {
  const step = nextStep(installation);
  return (
    <Section
      title="Projects"
      action={
        <Action
          label="Create project"
          to={step.to}
          size="sm"
          icon="start"
          disabled={scopeLoading}
        />
      }
    >
      {scopeLoading ? (
        <ProjectsTableWait />
      ) : state === "loading" ? (
        // Only the list waits for this read: the heading and Create project
        // are the workspace's, which the pane already has. The list draws one
        // placeholder row in the table's own frame.
        <Pending label="Loading projects" labelMode="screen-reader-only">
          <ProjectsTableWait />
        </Pending>
      ) : state === "empty" ? (
        <>
          <StateMessage
            title="Create your first project"
            icon="project"
            action={
              <Action
                instance="workspace-next-step"
                label={step.label}
                to={step.to}
                tone="primary"
                size="md"
              />
            }
          />
          <p className="fo-copy">{billing.publicProjects}</p>
        </>
      ) : (
        <>
          <div className="fo-panel">
            <Table
              moklyInstance="workspace-projects"
              label="Projects"
              columns={columns}
              rows={workspace.projects.map((project) => ({
                id: project.id,
                cells: [
                  { key: "name", value: project.name },
                  { key: "repository", value: project.repository, muted: true },
                ],
              }))}
            />
          </div>
          {plan === "free" && (
            <div className="review-inline">
              <p className="fo-copy">{billing.copy.privateUpload}</p>
              {role === "owner" ? (
                <Action
                  label="Open billing"
                  to="product/settings/billing"
                  size="sm"
                />
              ) : (
                <p className="fo-copy">{billing.copy.askOwner}</p>
              )}
            </div>
          )}
        </>
      )}
    </Section>
  );
}
