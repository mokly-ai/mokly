import type { IconName } from "../components/icons";
import type { Role } from "../api/types";

/** The settings sections and panes, shared by the dialog rail and the index. */
export const panes = [
  {
    id: "account",
    title: "Account",
    section: "You",
    icon: "account",
    summary: "Your name, email and GitHub connection",
    scope: "account",
  },
  {
    id: "workspace",
    title: "Workspace",
    section: "Workspace",
    icon: "workspace",
    summary: "Name, address and projects",
    scope: "workspace",
  },
  {
    id: "github",
    title: "GitHub accounts",
    section: "Workspace",
    icon: "github",
    summary: "Connected accounts and repository access",
    scope: "workspace",
  },
  {
    id: "members",
    title: "Members",
    section: "Workspace",
    icon: "members",
    summary: "People, roles and invitations",
    scope: "workspace",
  },
  {
    id: "billing",
    title: "Billing",
    section: "Workspace",
    icon: "billing",
    summary: "Plan, seats and payment",
    scope: "workspace",
    roles: ["owner", "admin"],
  },
  {
    id: "project",
    title: "Project",
    section: "Project",
    icon: "project",
    summary: "Name, address, repository and visibility",
    scope: "project",
  },
  {
    id: "tokens",
    title: "Publishing tokens",
    section: "Project",
    icon: "tokens",
    summary: "Tokens that publish this project",
    scope: "project",
  },
  {
    id: "access",
    title: "Access",
    section: "Project",
    icon: "access",
    summary: "Who can open this project",
    scope: "project",
  },
  {
    id: "danger",
    title: "Delete project",
    section: "Project",
    icon: "danger",
    summary: "Remove this project and its publications",
    scope: "project",
  },
] as const satisfies readonly {
  id: string;
  title: string;
  section: string;
  icon: IconName;
  summary: string;
  scope: "account" | "workspace" | "project";
  /** The roles this pane is shown to, where not every role reads it. */
  roles?: readonly Role[];
}[];

/** One registered pane, as the rail and the index both draw it. */
export type PaneDefinition = (typeof panes)[number];

/** The identifier one registered pane is addressed by. */
export type PaneId = (typeof panes)[number]["id"];

/** The mobile index is a route of the same registry, not a pane of its own. */
export type SurfaceId = PaneId | "sections";

/** The registry's sections, in rail order. */
export const sections = ["You", "Workspace", "Project"] as const;

/** What a pane needs in scope before it can be shown. */
export type PaneScope = (typeof panes)[number]["scope"];

const ids: ReadonlySet<string> = new Set(panes.map((pane) => pane.id));

/** Whether one registered pane is shown to the role the reader holds. */
function readableBy(pane: PaneDefinition, role: Role | undefined): boolean {
  const roles: readonly string[] | undefined =
    "roles" in pane ? pane.roles : undefined;
  return !roles || (role !== undefined && roles.includes(role));
}

/** Whether a URL value names a pane this build knows. */
export function isPaneId(value: string): value is PaneId {
  return ids.has(value);
}

/**
 * The panes a reader can open with the scope and the role they currently have.
 *
 * `role` is required rather than optional because a pane that only some roles
 * read is invisible when the answer is missing, and a call site that simply
 * forgot to ask would silently show Billing to a member. A surface with no
 * workspace in scope has no role to give and shows no workspace pane
 * either, so `undefined` is the honest answer there rather than a default.
 */
export function availablePanes(scope: {
  workspace: boolean;
  project: boolean;
  role: Role | undefined;
}): readonly (typeof panes)[number][] {
  return panes.filter((pane) => {
    if (!readableBy(pane, scope.role)) return false;
    if (pane.scope === "workspace") return scope.workspace;
    if (pane.scope === "project") return scope.project;
    return true;
  });
}

/**
 * An empty `settings` value shows the index; an unknown value opens the first
 * available pane, so a stale link never lands on nothing.
 */
export function resolvePane(
  value: string | undefined,
  available: readonly (typeof panes)[number][],
): SurfaceId {
  if (value === undefined || value.length === 0) return "sections";
  if (isPaneId(value) && available.some((pane) => pane.id === value)) {
    return value;
  }
  return available[0]?.id ?? "sections";
}
