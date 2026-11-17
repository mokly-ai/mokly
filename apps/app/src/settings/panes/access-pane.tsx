import type { ReactNode } from "react";

import { roleLabel } from "../../api/labels";
import type { Project } from "../../api/types";
import { Action } from "../../components/action";
import { ContentList } from "../../components/controls";
import type { WaitingContentRow } from "../../components/controls";
import { Pending, Section } from "../../components/page-parts";
import { listProjectGrants } from "../../data/projects";
import { useResource } from "../../data/use-resource";
import { PaneLink } from "../pane-link";
import { PaneResource } from "../../components/resource-state";

/**
 * The Access pane's layout, which the pane and its wait both draw: the access
 * the project inherits, with the way to the members, and the grants it adds.
 */
function AccessLayout({
  manage,
  inherited,
  direct,
}: {
  manage: ReactNode;
  inherited: ReactNode;
  direct: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <Section
        title="From the workspace"
        description="Everyone in the workspace already has this access."
        action={manage}
      >
        {inherited}
      </Section>
      <Section
        title="Project grants"
        description="Grants add access; they never reduce what the workspace allows."
      >
        {direct}
      </Section>
    </div>
  );
}

/**
 * One waiting row of a list of people: a bar for the name and the role, each
 * in its own line box, since the answer supplies both.
 */
const waitingPerson: WaitingContentRow = {
  id: "waiting",
  title: "",
  meta: true,
  waiting: true,
};

/**
 * The pane while the grants are read: each list keeps its section and draws
 * one placeholder row, and Manage members, whose label is known, draws itself
 * disabled.
 */
export function AccessWait() {
  return (
    <AccessLayout
      manage={<Action label="Manage members" size="sm" disabled />}
      inherited={
        <div className="fo-panel">
          <ContentList
            label="Inherited workspace access"
            rows={[waitingPerson]}
          />
        </div>
      }
      direct={
        <div className="fo-panel">
          <ContentList label="Project grants" rows={[waitingPerson]} />
        </div>
      }
    />
  );
}

/** Inherited workspace access beside the project's own grants. */
export function AccessPane({ project }: { project: Project }) {
  const grants = useResource(
    () => listProjectGrants(project.id),
    "grants:" + project.id,
  );
  return (
    <PaneResource
      resource={grants.state}
      waiting={
        <Pending label="Loading project access" labelMode="screen-reader-only">
          <AccessWait />
        </Pending>
      }
      failure="Access couldn’t load"
      onRetry={grants.reload}
    >
      {(items) => {
        const inherited = items.filter((grant) => grant.inherited);
        const direct = items.filter((grant) => !grant.inherited);
        return (
          <AccessLayout
            manage={<PaneLink label="Manage members" to="members" />}
            inherited={
              inherited.length === 0 ? (
                <p className="fo-copy">No inherited access.</p>
              ) : (
                <div className="fo-panel">
                  <ContentList
                    label="Inherited workspace access"
                    rows={inherited.map((grant) => ({
                      id: grant.id ?? grant.userId,
                      title: grant.name,
                      meta: roleLabel(grant.role),
                    }))}
                  />
                </div>
              )
            }
            direct={
              direct.length === 0 ? (
                <p className="fo-copy">No additional project grants.</p>
              ) : (
                <div className="fo-panel">
                  <ContentList
                    label="Project grants"
                    rows={direct.map((grant) => ({
                      id: grant.id ?? grant.userId,
                      title: grant.name,
                      meta: roleLabel(grant.role),
                    }))}
                  />
                </div>
              )
            }
          />
        );
      }}
    </PaneResource>
  );
}
