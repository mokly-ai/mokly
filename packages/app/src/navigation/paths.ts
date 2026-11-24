/** Account entry and onboarding paths that do not name a resource. */
export const dashboardPath = "/dashboard";
export const createWorkspacePath = "/new";
export const installPath = "/install";
export const signInPath = "/sign-in";
export const signUpPath = "/sign-up";

/** The browser page that signs the desktop app in from the browser's account. */
export const connectDesktopPath = "/connect/desktop";

/** The nonsecret pending-membership address carried by an invitation email. */
export function invitationAcceptancePath(
  workspaceId: string,
  memberId: string,
): string {
  return `/workspaces/${segment(workspaceId)}/invitations/${segment(memberId)}/accept`;
}

function segment(value: string): string {
  return encodeURIComponent(value);
}

/**
 * The install step for one workspace. With a candidate installation it is the
 * connect situation for that workspace, which the workspace step hands on to.
 */
export function installStepPath(
  workspaceId: string,
  installationId?: number,
): string {
  const step = `${installPath}?workspaceId=${segment(workspaceId)}`;
  return installationId === undefined
    ? step
    : `${step}&installationId=${installationId}`;
}

/**
 * The connect situation: an installation that arrived from GitHub with no
 * flow behind it, waiting for the reader to choose its workspace.
 */
export function connectInstallationPath(installationId: number): string {
  return `${installPath}?installationId=${installationId}`;
}

/** The workspace step, carrying a candidate installation on to the install step. */
export function createWorkspaceForPath(installationId: number): string {
  return `${createWorkspacePath}?installationId=${installationId}`;
}

/** The resolver for one workspace slug. */
export function workspacePath(workspaceSlug: string): string {
  return `/${segment(workspaceSlug)}`;
}

/** The repository step under one workspace. */
export function workspaceNewProjectPath(workspaceSlug: string): string {
  return `${workspacePath(workspaceSlug)}/-/new`;
}

/** The CLI form under one workspace: a project that publishes with the CLI. */
export function workspaceCliProjectPath(workspaceSlug: string): string {
  return `${workspaceNewProjectPath(workspaceSlug)}/cli`;
}

/** One project's canonical viewer path. */
export function projectPath(
  workspaceSlug: string,
  projectSlug: string,
): string {
  return `${workspacePath(workspaceSlug)}/${segment(projectSlug)}`;
}

/** A stable UUID permalink that resolves to a project's current slug path. */
export function projectPermalinkPath(projectId: string): string {
  return `/projects/${segment(projectId)}`;
}

/** The API path for one project's live channel. */
export function liveProjectPath(projectId: string): string {
  return `/v1/live/projects/${segment(projectId)}`;
}

/** The project-created publishing step. */
export function projectSetupPath(
  workspaceSlug: string,
  projectSlug: string,
): string {
  return `${projectPath(workspaceSlug, projectSlug)}/setup`;
}

/** One immutable publication in a project. */
export function publicationPath(
  workspaceSlug: string,
  projectSlug: string,
  publicationId: string,
): string {
  return `${projectPath(workspaceSlug, projectSlug)}/publications/${segment(publicationId)}`;
}

/** One cloud build's details, shown in its project's viewer stage. */
export function buildPath(
  workspaceSlug: string,
  projectSlug: string,
  buildId: string,
): string {
  return `${projectPath(workspaceSlug, projectSlug)}/builds/${segment(buildId)}`;
}

/** One pull-request alias in a project. */
export function pullRequestPath(
  workspaceSlug: string,
  projectSlug: string,
  number: number,
): string {
  return `${projectPath(workspaceSlug, projectSlug)}/pull-requests/${number}`;
}

/** One branch alias; branch names stay query values because they may contain `/`. */
export function branchPath(
  workspaceSlug: string,
  projectSlug: string,
  branch: string,
): string {
  const query = new URLSearchParams({ branch });
  return `${projectPath(workspaceSlug, projectSlug)}/branches?${query}`;
}

/** A durable settings destination with enough slugs for its scope. */
export type SettingsPathTarget =
  | { pane: "sections" | "account" }
  | {
      pane: "workspace" | "github" | "members" | "billing";
      workspaceSlug: string;
    }
  | {
      pane: "project" | "tokens" | "access" | "danger";
      workspaceSlug: string;
      projectSlug: string;
    };

/** The durable route form of one settings pane. */
export function settingsPath(target: SettingsPathTarget): string {
  if (target.pane === "sections") return "/settings";
  if (target.pane === "account") return "/settings/account";
  if (
    target.pane === "workspace" ||
    target.pane === "github" ||
    target.pane === "members" ||
    target.pane === "billing"
  ) {
    const base = `${workspacePath(target.workspaceSlug)}/-/settings`;
    return target.pane === "workspace" ? base : `${base}/${target.pane}`;
  }
  if (!("projectSlug" in target)) return "/settings";
  const base = `${projectPath(
    target.workspaceSlug,
    target.projectSlug,
  )}/settings`;
  return target.pane === "project" ? base : `${base}/${target.pane}`;
}
