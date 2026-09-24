import React from "react";

import { defineCollection, defineScreen } from "@mokly/mokly";

import { WorkspacePanel } from "../ui/workspace-panel.js";

const metadata = {
  description: "A Juno-shaped fixture with unrelated repository roots.",
  relatedDocs: ["spec/workspace.md"],
  useCaseIds: [],
};

export const mockups = [
  defineCollection({
    childIds: ["workspace-overview"],
    description: "Workspace screens.",
    id: "workspace",
    relatedDocs: metadata.relatedDocs,
    title: "Workspace",
  }),
  defineScreen({
    ...metadata,
    desktop: <WorkspacePanel layout="wide" />,
    id: "workspace-overview",
    mobile: <WorkspacePanel layout="compact" />,
    route: "workspace/overview.html",
    title: "Workspace overview",
  }),
];
