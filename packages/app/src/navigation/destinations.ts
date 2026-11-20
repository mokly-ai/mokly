import { asApiError } from "../api/errors";
import type { Workspace, Project } from "../api/types";
import { getProject, listProjects } from "../data/projects";
import { listWorkspaces } from "../data/workspaces";

import { readLastProject } from "./last-opened";
import {
  createWorkspacePath,
  dashboardPath,
  installStepPath,
  workspaceNewProjectPath,
  projectPath,
  signInPath,
} from "./paths";

/** Where a product route ends once the reader's own access is known. */
export interface TerminalDestination {
  href: string;
  project?: Project;
  workspace?: Workspace;
}

function chooseProject(
  projects: readonly Project[],
  remembered: string | undefined,
): Project | undefined {
  return (
    projects.find((candidate) => candidate.id === remembered) ?? projects[0]
  );
}

/**
 * Where a reader with no project is sent: the install step while there is
 * nothing the App can read repositories through, and the repository step once
 * there is. A suspended binding lists no repositories and is resumed on
 * GitHub, which is what the install step offers, so it goes there too.
 */
function firstStep(workspace: Workspace): string {
  return workspace.githubInstallationState === "connected"
    ? workspaceNewProjectPath(workspace.slug)
    : installStepPath(workspace.id);
}

/**
 * Resolve `/dashboard` or one already-authorized workspace to a terminal destination. Every
 * product route ends inside the viewer where the reader has one project, and in
 * onboarding where they have none; no route ends on an error page.
 */
export async function resolveHome(
  workspace?: Workspace,
): Promise<TerminalDestination> {
  const remembered = readLastProject();
  if (!workspace && remembered) {
    try {
      const project = await getProject(remembered);
      return {
        href: projectPath(project.workspaceSlug, project.slug),
        project,
      };
    } catch (caught) {
      const error = asApiError(caught);
      if (
        !error ||
        (error.reason !== "not-found" && error.reason !== "permission-denied")
      ) {
        throw caught;
      }
    }
  }
  const workspaces = workspace ? [] : await listWorkspaces();
  const selected = workspace ?? workspaces[0];
  // Having no workspace means onboarding, which opens at the workspace
  // step; there is no earlier one.
  if (!selected) return { href: createWorkspacePath };
  const projects = await listProjects(selected.id);
  const project = chooseProject(projects, remembered);
  if (!project) {
    return { href: firstStep(selected), workspace: selected };
  }
  return {
    href: projectPath(project.workspaceSlug, project.slug),
    project,
    workspace: selected,
  };
}

/**
 * Where a signed-out reader is sent, carrying the address they were trying to
 * reach so signing in returns them to it. Every surface uses this, so one
 * reader's way back is not shorter than another's.
 */
export function signInHref(destination?: string): string {
  const here =
    destination ??
    (typeof window === "undefined"
      ? dashboardPath
      : window.location.pathname + window.location.search);
  return signInPath + "?returnTo=" + encodeURIComponent(here);
}
