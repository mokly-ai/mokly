import { defineScreen } from "@mokly/mokly";

import {
  CliFormEmptyScreen,
  CliFormErrorScreen,
  CliFormLoadingScreen,
  CliFormScreen,
  CliFormWorkspaceLoadingScreen,
} from "../../../../screens/product/account/cli-form-screen";

/** The named screen component that each state draws. */
const screens = {
  default: CliFormScreen,
  empty: CliFormEmptyScreen,
  loading: CliFormLoadingScreen,
  error: CliFormErrorScreen,
  "workspace-loading": CliFormWorkspaceLoadingScreen,
};

export default defineScreen({
  title: "Publish with the CLI",
  description:
    "The CLI form at /:workspace/-/new/cli: the repository as the Mokly CLI identifies it, here from a host other than github.com, the config path, the project slug with its address and Create project. Back returns to the repository step, because this workspace has connected accounts. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
    "docs/protocol/cloud/platform-model.md",
  ],
  tags: ["product", "folio", "account", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: {
      state: {
        enum: ["default", "empty", "loading", "error", "workspace-loading"],
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
      title: "Publish with the CLI · Empty",
      description:
        "The untouched form for a workspace with nothing installed, reached from the install step: the repository shows the shape it takes, Create project waits, the strip claims no installation and Back returns to the install step. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Publish with the CLI · Creating",
      description:
        "The project being created: the fields hold what was sent, and Create project reads Creating… with the busy spinner, refuses a second press and is heard as Creating project. The form inserts nothing. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Publish with the CLI · Error",
      description:
        "The duplicate-project refusal: the repository already has a project, so the sentence beside Create project links to it, the control keeps its label and the reference stays beneath it. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
    {
      slug: "workspace-loading",
      title: "Publish with the CLI · Loading your workspace",
      description:
        "The workspace read: the form in waiting form, with the address line saying Loading your workspace…, Create project disabled, Back and the strip at step 3. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "workspace-loading" },
    },
  ],
});
