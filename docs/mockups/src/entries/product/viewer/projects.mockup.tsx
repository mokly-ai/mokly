import { defineScreen } from "@mokly/mokly";

import {
  ViewerProjectsEmptyScreen,
  ViewerProjectsErrorScreen,
  ViewerProjectsLoadingScreen,
  ViewerProjectsScreen,
} from "../../../screens/product/viewer/projects-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ViewerProjectsScreen,
  empty: ViewerProjectsEmptyScreen,
  loading: ViewerProjectsLoadingScreen,
  error: ViewerProjectsErrorScreen,
};

export default defineScreen({
  title: "Projects",
  description:
    "Projects — workspaces, their projects, Create project and Create workspace. The project the reader is in says Current.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/viewer.md",
  ],
  tags: ["product", "canvas", "viewer", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "empty", "loading", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Projects · Empty",
      description: "Projects — a workspace with no project yet.",
      tags: ["product", "canvas", "viewer", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Projects · Loading",
      description:
        "Projects — the panel loads over the viewer: one workspace group with its name and accounts as bars, one placeholder row and its settings control as a placeholder, and Create project and Create workspace disabled.",
      tags: ["product", "canvas", "viewer", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Projects · Error",
      description: "Projects — the list could not load and offers one retry.",
      tags: ["product", "canvas", "viewer", "error"],
      props: { state: "error" },
    },
  ],
});
