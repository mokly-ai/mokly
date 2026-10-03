import React from "react";

import { defineScreen } from "@mokly/mokly";

import { WorkspacePanel } from "../ui/workspace-panel.js";

const metadata = {
  description: "A Juno-shaped fixture with unrelated repository roots.",
  relatedDocs: ["spec/workspace.md"],
  useCaseIds: [],
};

export const mockups = [
  defineScreen({
    ...metadata,
    navPath: ["Workspace"],
    desktop: <WorkspacePanel layout="wide" />,
    id: "workspace-overview",
    mobile: <WorkspacePanel layout="compact" />,
    title: "Workspace overview",
  }),
];
