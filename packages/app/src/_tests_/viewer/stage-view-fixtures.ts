import type { Project } from "../../api/types";

export const project: Project = {
  id: "project",
  workspaceId: "workspace",
  workspaceSlug: "workspace",
  name: "Private project",
  slug: "private-project",
  repository: "mokly-ai/private",
  configPath: "mokly.config.json",
  visibility: "private",
  requireApproval: false,
  canAdmin: true,
  publishingAllowed: false,
  automaticBuilds: false,
  buildsAvailable: false,
  canRequestBuilds: false,
  version: 1,
};

export const building: Project = {
  ...project,
  publishingAllowed: true,
  buildsAvailable: true,
  canRequestBuilds: true,
};

export const owner = {
  status: "ready",
  value: {
    id: "workspace",
    name: "Workspace",
    slug: "workspace",
    role: "owner",
    plan: "team",
    githubInstallationState: "connected",
    version: 1,
  },
} as const;

export const branch = { kind: "branch", name: "topic" } as const;

export const pull = { kind: "pull-request", number: 4 } as const;
