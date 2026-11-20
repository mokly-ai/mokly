import { defineScreen } from "@mokly/mokly";

import {
  ConnectEmptyScreen,
  ConnectErrorScreen,
  ConnectLoadingScreen,
  ConnectOneWorkspaceScreen,
  ConnectScreen,
} from "../../../../../screens/product/account/connect-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ConnectScreen,
  empty: ConnectEmptyScreen,
  loading: ConnectLoadingScreen,
  error: ConnectErrorScreen,
  "one-workspace": ConnectOneWorkspaceScreen,
};

export default defineScreen({
  title: "Connect a GitHub account",
  description:
    "The install step at /install?installationId=N, for an installation that arrived from GitHub with no flow behind it: a Workspace select over the workspaces the reader administers, and Continue on GitHub, which proves the reader administers the account. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
    "docs/protocol/cloud/github-app.md",
  ],
  tags: ["product", "folio", "account", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: ["default", "empty", "loading", "error", "one-workspace"],
      },
    },
  } as const,
  props: { state: "default" },
  render: ({ state }, { viewport }) => {
    const Screen = screens[state];
    return <Screen viewport={viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Connect a GitHub account · No workspace",
      description:
        "A reader who administers no workspace makes one first; Create a workspace opens the workspace step, which carries the installation on to the install step. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Connect a GitHub account · Loading",
      description:
        "The workspaces the reader administers loading: the Workspace field holds Loading your workspaces…, and Continue on GitHub, whose label the workspaces decide, is a placeholder in its own box. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Connect a GitHub account · Error",
      description:
        "The workspaces failing to load, with Try again and its reference. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
    {
      slug: "one-workspace",
      title: "Connect a GitHub account · One workspace",
      description:
        "The address names one workspace, or the reader administers exactly one, so the workspace is a fact row rather than a choice. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "default"],
      props: { state: "one-workspace" },
    },
  ],
});
