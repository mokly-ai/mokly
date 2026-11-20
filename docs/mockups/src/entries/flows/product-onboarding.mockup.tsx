import { defineUseCase } from "@mokly/mokly";

export default defineUseCase({
  title: "Create a workspace and project",
  description:
    "Cal creates a Mokly account and connects the Mokly Cloud repository.",

  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/product-navigation.md",
    "docs/protocol/cloud/product-accounts-and-roles.md",
  ],
  tags: ["product", "folio"],
  steps: [
    { screenPath: "product/account/sign-up", title: "Create an account" },
    {
      screenPath: "product/account/magic-link",
      title: "Open the email link",
    },
    {
      description:
        "The message Cal opens: one action, the link written out beneath it, and how long it lasts.",
      screenPath: "design/email/sign-in",
      title: "Read the sign-in email",
    },
    {
      screenPath: "product/account/create-workspace",
      title: "Create Mokly",
    },
    {
      screenPath: "product/account/install-app",
      title: "Install the Mokly app",
    },
    {
      screenPath: "product/account/choose-repository",
      title: "Choose Mokly Cloud",
    },
    {
      screenPath: "product/account/project-created",
      title: "Open the new project",
      description:
        "Mokly is already publishing the default branch; Open project opens the project's viewer, and the CI setup guide stays the other way to publish.",
    },
    {
      screenPath: "product/viewer/standalone/publish/publishing",
      title: "Watch the first publication",
      description:
        "The viewer is the application, so onboarding ends inside it: the chrome is mounted and the stage shows the default branch's first build.",
    },
  ],
});
