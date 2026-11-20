import type { Page } from "@playwright/test";

import {
  branchPath,
  workspacePath,
  projectPath,
  publicationPath,
  pullRequestPath,
  settingsPath,
} from "../navigation/paths";

import { apiOrigin } from "./origins";

/** The current canonical address fields for one UUID workspace. */
export interface WorkspaceAddress {
  slug: string;
  path: string;
}

/** The current canonical address fields for one UUID project. */
export interface ProjectAddress {
  workspaceSlug: string;
  slug: string;
  path: string;
}

/** Resolve a stable workspace identity to its current slug address. */
export async function workspaceAddress(
  page: Page,
  workspaceId: string,
): Promise<WorkspaceAddress> {
  const slug = await page.evaluate(
    async ([origin, id]) => {
      const answer = await fetch(`${origin}/v1/workspaces/${id}`, {
        credentials: "include",
      });
      if (!answer.ok) {
        throw new Error(`workspace lookup failed: ${answer.status}`);
      }
      return ((await answer.json()) as { slug: string }).slug;
    },
    [apiOrigin, workspaceId] as const,
  );
  return { slug, path: workspacePath(slug) };
}

/** Resolve a stable project identity to its current two-slug address. */
export async function projectAddress(
  page: Page,
  projectId: string,
): Promise<ProjectAddress> {
  const project = await page.evaluate(
    async ([origin, id]) => {
      const answer = await fetch(`${origin}/v1/projects/${id}`, {
        credentials: "include",
      });
      if (!answer.ok)
        throw new Error(`project lookup failed: ${answer.status}`);
      return (await answer.json()) as {
        workspaceSlug: string;
        slug: string;
      };
    },
    [apiOrigin, projectId] as const,
  );
  return {
    ...project,
    path: projectPath(project.workspaceSlug, project.slug),
  };
}

/** Current canonical viewer path for one UUID project. */
export async function projectPathFor(
  page: Page,
  projectId: string,
): Promise<string> {
  return (await projectAddress(page, projectId)).path;
}

/** Current canonical immutable-publication path for one UUID project. */
export async function publicationPathFor(
  page: Page,
  projectId: string,
  publicationId: string,
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return publicationPath(address.workspaceSlug, address.slug, publicationId);
}

/** Current canonical pull-request alias for one UUID project. */
export async function pullRequestPathFor(
  page: Page,
  projectId: string,
  number: number,
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return pullRequestPath(address.workspaceSlug, address.slug, number);
}

/** Current canonical branch alias for one UUID project. */
export async function branchPathFor(
  page: Page,
  projectId: string,
  branch: string,
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return branchPath(address.workspaceSlug, address.slug, branch);
}

/** A canonical project address with the supplied query text. */
export async function projectQueryPathFor(
  page: Page,
  projectId: string,
  query: string,
): Promise<string> {
  const path = await projectPathFor(page, projectId);
  return query ? `${path}?${query}` : path;
}

/** Durable project settings path from a stable UUID fixture identity. */
export async function projectSettingsPathFor(
  page: Page,
  projectId: string,
  pane: "project" | "tokens" | "access" | "danger",
): Promise<string> {
  const address = await projectAddress(page, projectId);
  return settingsPath({
    pane,
    workspaceSlug: address.workspaceSlug,
    projectSlug: address.slug,
  });
}

/** Durable workspace settings path from a stable UUID fixture identity. */
export async function workspaceSettingsPathFor(
  page: Page,
  workspaceId: string,
  pane: "workspace" | "github" | "members" | "billing",
): Promise<string> {
  const address = await workspaceAddress(page, workspaceId);
  return settingsPath({ pane, workspaceSlug: address.slug });
}
