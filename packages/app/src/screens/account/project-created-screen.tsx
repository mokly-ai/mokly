import type { ReactNode } from "react";

import { visibilityLabel } from "../../api/labels";
import type { Branch, Project, User } from "../../api/types";
import { Action } from "../../components/action";
import { Facts, Pending, SiteLink } from "../../components/page-parts";
import {
  ControlPlaceholder,
  factPlaceholder,
} from "../../components/placeholders";
import { appAddress, site } from "../../config";
import { listBranches } from "../../data/publications";
import { useResource } from "../../data/use-resource";
import { projectPath } from "../../navigation/paths";
import { buildActive } from "../../viewer/build-state";

import { AccountShell } from "./account-shell";
import type { ShellWait, WaitingIdentity } from "./account-shell";

/**
 * The default branch row, which the API lists first. A read that fails is the
 * same as one that finds nothing publishing: the guide leads and the project
 * still opens, because nothing here is worth stopping the reader for.
 */
async function defaultBranch(projectId: string): Promise<Branch | undefined> {
  try {
    return (await listBranches(projectId)).items[0];
  } catch {
    return undefined;
  }
}

/**
 * The facts the finished project is set up from, each with the width of the
 * bar that holds its value while the project is read.
 */
const facts: readonly {
  label: string;
  bar: string;
  value: (project: Project) => ReactNode;
}[] = [
  {
    label: "Address",
    bar: "16em",
    value: (project) =>
      appAddress(projectPath(project.workspaceSlug, project.slug)),
  },
  { label: "Repository", bar: "11em", value: (project) => project.repository },
  {
    label: "Config",
    bar: "10em",
    value: (project) => <code>{project.configPath}</code>,
  },
  {
    label: "Visibility",
    bar: "3.5em",
    value: (project) => visibilityLabel(project.visibility),
  },
];

/**
 * The finished project's panel, loaded or waiting: its name, the facts it is
 * set up from and its controls. Until the project is read, its name is a bar
 * in the heading's line and each fact holds a bar, and the tab still names
 * the page.
 */
function ProjectCreatedLayout({
  identity,
  project,
  detail,
  below,
  wait,
  actions,
}: {
  identity: WaitingIdentity;
  /** The project, once its read has answered. */
  project?: Project;
  detail?: string;
  below?: ReactNode;
  wait?: ShellWait;
  actions: ReactNode;
}) {
  const title =
    project === undefined
      ? { title: { bar: "min(10em, 100%)" }, documentTitle: "Project setup" }
      : { title: project.name + " is ready" };
  return (
    <AccountShell
      screen="account-project-created"
      {...title}
      detail={detail}
      identity={identity}
      below={below}
      wait={wait}
    >
      <Facts
        ruled
        rows={facts.map((fact) =>
          project === undefined
            ? factPlaceholder(fact.label, fact.bar)
            : ([fact.label, fact.value(project)] as const),
        )}
      />
      <div className="fo-account-actions">{actions}</div>
    </AccountShell>
  );
}

/**
 * The finished project while the project and its default branch are read: the
 * panel with nothing publishing, its most common form. The branch decides
 * which controls there are, so two placeholders hold their boxes. No visible
 * place names the read, so screen readers hear it: as the heading while the
 * project's name waits as a bar, and as the region's status once the heading
 * shows the name.
 */
export function ProjectCreatedWait({
  identity,
  project,
}: {
  identity: WaitingIdentity;
  project?: Project;
}) {
  return (
    <ProjectCreatedLayout
      identity={identity}
      project={project}
      wait={(panel) => (
        <Pending label="Opening your project" labelMode="screen-reader-only">
          {project === undefined ? panel : panel(undefined)}
        </Pending>
      )}
      actions={
        <>
          <ControlPlaceholder />
          <ControlPlaceholder />
        </>
      }
    />
  );
}

/**
 * The project exists. When creation scheduled the default branch's first
 * build, the screen says so and Open project leads into the viewer where it
 * runs, with the CI setup guide as the other way; when nothing is publishing,
 * the guide leads and Open project follows.
 */
export function ProjectCreatedScreen({
  user,
  project,
}: {
  user: User;
  project: Project;
}) {
  const branch = useResource(
    () => defaultBranch(project.id),
    "project-created-branch:" + project.id,
  );
  const identity = { kind: "signed-in", user } as const;
  const open = projectPath(project.workspaceSlug, project.slug);
  if (branch.state.status !== "ready") {
    return <ProjectCreatedWait identity={identity} project={project} />;
  }
  const publishing = branch.state.value;
  if (publishing?.newestBuild && buildActive(publishing.newestBuild.state)) {
    return (
      <ProjectCreatedLayout
        identity={identity}
        project={project}
        detail={"Mokly is publishing " + publishing.name + "."}
        below={
          <p className="fo-account-switch">
            <SiteLink href={site.publishFromCi} label="Publish from CI" />
          </p>
        }
        actions={
          <Action
            label="Open project"
            tone="primary"
            block
            href={open}
            testID="open-project"
          />
        }
      />
    );
  }
  return (
    <ProjectCreatedLayout
      identity={identity}
      project={project}
      actions={
        <>
          <Action
            label="Publish from CI"
            tone="primary"
            icon="external"
            block
            href={site.publishFromCi}
            testID="publish-from-ci"
          />
          <Action
            label="Open project"
            tone="secondary"
            block
            href={open}
            testID="open-project"
          />
        </>
      }
    />
  );
}
