import {
  api,
  correlationHeader,
  expectBody,
  expectData,
  mutationHeaders,
} from "../api/client";
import type {
  CreateProject,
  Project,
  ProjectGrant,
  ProjectSlugLookup,
  Visibility,
} from "../api/types";

/** Projects in one workspace. */
export async function listProjects(workspaceId: string): Promise<Project[]> {
  const page = await expectBody((id) =>
    api.GET("/v1/workspaces/{workspaceId}/projects", {
      params: { path: { workspaceId } },
      headers: correlationHeader(id),
    }),
  );
  return page.items;
}

/**
 * Create a project from an installed repository, or from a repository the
 * Mokly CLI identifies, which publishes with the CLI and links no repository.
 */
export function createProject(
  workspaceId: string,
  input: CreateProject,
): Promise<Project> {
  return expectBody((id) =>
    api.POST("/v1/workspaces/{workspaceId}/projects", {
      params: { path: { workspaceId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Ask the API for an available project slug derived from repository/config. */
export function suggestProjectSlug(
  workspaceId: string,
  input: { repository: string; configPath: string },
): Promise<string> {
  return expectBody((id) =>
    api.GET("/v1/workspaces/{workspaceId}/projects/slug-suggestion", {
      params: {
        path: { workspaceId },
        query: input,
      },
      headers: correlationHeader(id),
    }),
  ).then((suggestion) => suggestion.slug);
}

/** Read one project and whether the reader administers it. */
export function getProject(projectId: string): Promise<Project> {
  return expectBody((id) =>
    api.GET("/v1/projects/{projectId}", {
      params: { path: { projectId } },
      headers: correlationHeader(id),
    }),
  );
}

/** Resolve current or retired workspace/project slugs to one project. */
export function getProjectBySlug(
  workspaceSlug: string,
  projectSlug: string,
): Promise<ProjectSlugLookup> {
  return expectBody((id) =>
    api.GET("/v1/workspaces/by-slug/{workspaceSlug}/projects/{projectSlug}", {
      params: { path: { workspaceSlug, projectSlug } },
      headers: correlationHeader(id),
    }),
  );
}

/**
 * Save a project's name, visibility and approval policy. `automaticBuilds` is
 * sent only by the control that changes it; absent, the API keeps the setting.
 */
export function updateProject(
  projectId: string,
  input: {
    name: string;
    slug: string;
    visibility: Visibility;
    requireApproval: boolean;
    version: number;
    automaticBuilds?: boolean;
  },
): Promise<Project> {
  return expectBody((id) =>
    api.PATCH("/v1/projects/{projectId}", {
      params: { path: { projectId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  );
}

/** Delete a project after its name is confirmed. */
export function deleteProject(
  projectId: string,
  input: { confirmationName: string; version: number },
): Promise<void> {
  return expectData((id) =>
    api.DELETE("/v1/projects/{projectId}", {
      params: { path: { projectId }, header: mutationHeaders() },
      headers: correlationHeader(id),
      body: input,
    }),
  ).then(() => undefined);
}

/** Inherited workspace access and direct grants on one project. */
export async function listProjectGrants(
  projectId: string,
): Promise<ProjectGrant[]> {
  const page = await expectBody((id) =>
    api.GET("/v1/projects/{projectId}/members", {
      params: { path: { projectId } },
      headers: correlationHeader(id),
    }),
  );
  return page.items;
}
