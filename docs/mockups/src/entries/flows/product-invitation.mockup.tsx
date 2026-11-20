import { defineUseCase } from "@mokly/mokly";

export default defineUseCase({
  description: "Cal invites Sam to the workspace, and Sam signs in to accept.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/email.md",
    "docs/protocol/cloud/platform-model.md",
  ],
  steps: [
    { screenPath: "product/settings/members", title: "Invite Sam" },
    {
      description:
        "Sam reads who invited them and to which workspace before opening anything.",
      screenPath: "design/email/invitation",
      title: "Open the invitation",
    },
    {
      screenPath: "product/account/sign-in",
      title: "Sign in with the invited address",
    },
    {
      screenPath: "product/account/invitation-accept",
      title: "Accept the invitation",
    },
  ],
  tags: ["product", "folio"],
  title: "Invite someone to the workspace",
});
