import type { Project } from "../api/types";
import { workspacePath, projectPath } from "./paths";

function tailAfter(pathname: string, segments: number): string {
  const parts = pathname.split("/");
  const tail = parts.slice(segments + 1).join("/");
  return tail.length > 0 ? `/${tail}` : pathname.endsWith("/") ? "/" : "";
}

/** Replace a workspace slug while preserving the complete tail and query. */
export function canonicalWorkspaceAddress(
  pathname: string,
  search: string,
  canonicalSlug: string,
): string {
  return workspacePath(canonicalSlug) + tailAfter(pathname, 1) + search;
}

function segmentAt(pathname: string, index: number): string | undefined {
  const value = pathname.split("/")[index + 1];
  if (value === undefined) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

/** Keep a static/onboarding working page unless its route names this workspace. */
export function canonicalWorkspaceWorkingRoute(
  pathname: string,
  search: string,
  previousSlug: string,
  canonicalSlug: string,
): string {
  return segmentAt(pathname, 0) === previousSlug
    ? canonicalWorkspaceAddress(pathname, search, canonicalSlug)
    : pathname + search;
}

/** Replace both slug segments while preserving the complete tail and query. */
export function canonicalProjectAddress(
  pathname: string,
  search: string,
  canonicalWorkspaceSlug: string,
  canonicalProjectSlug: string,
): string {
  return (
    projectPath(canonicalWorkspaceSlug, canonicalProjectSlug) +
    tailAfter(pathname, 2) +
    search
  );
}

/** Keep a static/onboarding working page unless its route names this project. */
export function canonicalProjectWorkingRoute(
  pathname: string,
  search: string,
  previousWorkspaceSlug: string,
  previousProjectSlug: string,
  canonicalWorkspaceSlug: string,
  canonicalProjectSlug: string,
): string {
  return segmentAt(pathname, 0) === previousWorkspaceSlug &&
    segmentAt(pathname, 1) === previousProjectSlug
    ? canonicalProjectAddress(
        pathname,
        search,
        canonicalWorkspaceSlug,
        canonicalProjectSlug,
      )
    : pathname + search;
}

/** Replace a legacy `/projects/:uuid` prefix with the project's slug prefix. */
export function canonicalProjectPermalink(
  pathname: string,
  search: string,
  project: Project,
): string {
  return (
    projectPath(project.workspaceSlug, project.slug) +
    tailAfter(pathname, 2) +
    search
  );
}
