import React from "react";

import { defineScreen } from "@mokly/mokly";

import { WorkspacePanel } from "../ui/workspace-panel.js";

const metadata = {
  dependencies: ["spec/ui/workspace-panel.tsx"],
  description: "A Juno-shaped fixture with unrelated repository roots.",
  relatedDocs: ["spec/workspace.md"],
  useCasePaths: [],
};

export const mockups = [
  defineScreen({
    slug: "workspace-overview",
    ...metadata,

    desktop: <WorkspacePanel layout="wide" />,
    path: "workspace-overview",
    mobile: <WorkspacePanel layout="compact" />,
    title: "Workspace overview",
  }),
];
