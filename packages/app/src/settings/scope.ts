import { useCallback } from "react";

import { asApiError } from "../api/errors";
import type { Workspace, Project } from "../api/types";
import { getProject, getProjectBySlug, listProjects } from "../data/projects";
import {
  workspaceResourceScope,
  projectResourceScope,
} from "../data/resource-invalidation";
import { useResource } from "../data/use-resource";
import type { Resource } from "../data/use-resource";
import { getWorkspaceBySlug, listWorkspaces } from "../data/workspaces";
import { readLastProject } from "../navigation/last-opened";

import type { SettingsScopeSlugs } from "./routes";

/** The workspace and project one settings surface was opened against. */
export interface SettingsScope {
  workspaces: Workspace[];
  workspace?: Workspace;
  project?: Project;
}

/**
 * The slugs that a settings scope gives each pane's address, or none while it
 * has not been read. A scope with no workspace, as a project-only guest's,
 * takes the workspace's slug from its project.
 */
export function scopeSlugs(
  scope: SettingsScope | undefined,
): SettingsScopeSlugs {
  return {
    workspaceSlug: scope?.workspace?.slug ?? scope?.project?.workspaceSlug,
    projectSlug: scope?.project?.slug,
  };
}

/** Only hidden/inaccessible scope is optional; operational failures stay errors. */
export function missingSettingsScope(caught: unknown): boolean {
  const error = asApiError(caught);
  return error?.reason === "not-found" || error?.reason === "permission-denied";
}

async function resolveProjectFor(
  workspace: Workspace,
): Promise<Project | undefined> {
  const projects = await listProjects(workspace.id);
  const remembered = readLastProject();
  return (
    projects.find((candidate) => candidate.id === remembered) ?? projects[0]
  );
}

/**
 * Resolve the settings scope from the route. A named project that the reader
 * cannot open hides the project section instead of failing the surface, as the
 * navigation contract requires. A surface that names no project — the settings
 * index — resolves the reader's last opened or first accessible one, so the
 * Project section is reachable there too.
 */
export function useSettingsScope(ids: {
  workspaceId?: string;
  projectId?: string;
  workspaceSlug?: string;
  projectSlug?: string;
  resolveProject?: boolean;
  enabled?: boolean;
}): { state: Resource<SettingsScope>; reload: () => void } {
  const {
    workspaceId,
    projectId,
    workspaceSlug,
    projectSlug,
    resolveProject,
    enabled = true,
  } = ids;
  const load = useCallback(async (): Promise<SettingsScope> => {
    const workspaces = await listWorkspaces();
    let project: Project | undefined;
    if (workspaceSlug && projectSlug) {
      try {
        project = await getProjectBySlug(workspaceSlug, projectSlug);
      } catch (caught) {
        if (!missingSettingsScope(caught)) throw caught;
      }
    } else if (projectId) {
      try {
        project = await getProject(projectId);
      } catch (caught) {
        if (!missingSettingsScope(caught)) throw caught;
      }
    }
    const wanted = workspaceId ?? project?.workspaceId;
    let workspace =
      workspaces.find((candidate) => candidate.id === wanted) ??
      (wanted || workspaceSlug ? undefined : workspaces[0]);
    if (!project && workspaceSlug) {
      try {
        workspace = await getWorkspaceBySlug(workspaceSlug);
      } catch (caught) {
        if (!missingSettingsScope(caught)) throw caught;
      }
    }
    if (!project && resolveProject && workspace) {
      project = await resolveProjectFor(workspace);
    }
    return { workspaces, workspace, project };
  }, [workspaceId, projectId, workspaceSlug, projectSlug, resolveProject]);
  const resource = useResource(
    load,
    `scope:${workspaceId ?? ""}:${projectId ?? ""}:${workspaceSlug ?? ""}:${projectSlug ?? ""}:${resolveProject ? "resolve" : ""}`,
    enabled,
    (value) => [
      ...(value.workspace ? [workspaceResourceScope(value.workspace.id)] : []),
      ...(value.project ? [projectResourceScope(value.project.id)] : []),
    ],
  );
  return { state: resource.state, reload: resource.reload };
}
