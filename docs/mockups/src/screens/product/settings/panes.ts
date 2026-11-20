import type { IconName } from "../icons";

/** The settings sections and panes, shared by the dialog rail and the index. */
export const panes = [
  {
    id: "account",
    title: "Account",
    section: "You",
    icon: "account",
    summary: "Your name, email and GitHub connection",
  },
  {
    id: "workspace",
    title: "Workspace",
    section: "Workspace",
    icon: "workspace",
    summary: "Name, address and projects",
  },
  {
    id: "github",
    title: "GitHub accounts",
    section: "Workspace",
    icon: "github",
    summary: "Connected accounts and repository access",
  },
  {
    id: "members",
    title: "Members",
    section: "Workspace",
    icon: "members",
    summary: "People, roles and invitations",
  },
  {
    id: "billing",
    title: "Billing",
    section: "Workspace",
    icon: "billing",
    summary: "Plan, seats and payment",
  },
  {
    id: "project",
    title: "Project",
    section: "Project",
    icon: "project",
    summary: "Name, repository and visibility",
  },
  {
    id: "tokens",
    title: "Publishing tokens",
    section: "Project",
    icon: "tokens",
    summary: "Tokens that publish this project",
  },
  {
    id: "access",
    title: "Access",
    section: "Project",
    icon: "access",
    summary: "Who can open this project",
  },
  {
    id: "danger",
    title: "Delete project",
    section: "Project",
    icon: "danger",
    summary: "Remove this project and its publications",
  },
] as const satisfies readonly {
  id: string;
  title: string;
  section: string;
  icon: IconName;
  summary: string;
}[];

export type PaneId = (typeof panes)[number]["id"];

/** The mobile index is a route of the same registry, not a pane of its own. */
export type SurfaceId = PaneId | "sections";

export const sections = ["You", "Workspace", "Project"] as const;

export function paneScreenPath(id: SurfaceId) {
  return "product/settings/" + id;
}
