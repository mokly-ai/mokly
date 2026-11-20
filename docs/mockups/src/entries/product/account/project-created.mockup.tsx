import { defineScreen } from "@mokly/mokly";

import {
  ProjectCreatedEmptyScreen,
  ProjectCreatedErrorScreen,
  ProjectCreatedLoadingScreen,
  ProjectCreatedScreen,
} from "../../../screens/product/account/project-created-screen";

/** The named screen component that each state draws. */
const screens = {
  default: ProjectCreatedScreen,
  empty: ProjectCreatedEmptyScreen,
  loading: ProjectCreatedLoadingScreen,
  error: ProjectCreatedErrorScreen,
};

export default defineScreen({
  title: "Project created",
  description:
    "Project created \u2014 creation scheduled the default branch's first build, so the panel says it is publishing, Open project leads to the viewer where it runs and the CI setup guide stays the other way. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
    "docs/protocol/cloud/viewer-builds.md",
  ],
  useCasePaths: ["flows/product-onboarding"],
  tags: ["product", "folio", "account", "default"],
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
      title: "Project created \u00b7 Empty",
      description:
        "Project created \u2014 nothing is publishing, so the CI setup guide leads and Open project follows. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "empty"],
      props: { state: "empty" },
    },
    {
      slug: "loading",
      title: "Project created \u00b7 Loading",
      description:
        "The project and its default branch loading: the title as a bar of its line height, the four facts with their values as bars, and two control placeholders. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "loading"],
      props: { state: "loading" },
    },
    {
      slug: "error",
      title: "Project created \u00b7 Error",
      description:
        "Project created \u2014 error scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "account", "error"],
      props: { state: "error" },
    },
  ],
});
