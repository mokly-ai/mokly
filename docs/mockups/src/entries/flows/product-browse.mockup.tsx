import { defineUseCase } from "@mokly/mokly";

export default defineUseCase({
  title: "Read a publication and share it",
  description:
    "Cal moves from the branch he is reading into a pull request, checks what was published before, and copies the link.",

  relatedDocs: [
    "docs/protocol/cloud/viewer.md",
    "docs/protocol/cloud/product-mockups.md",
  ],
  tags: ["product", "folio"],
  steps: [
    { screenPath: "product/viewer/standalone", title: "Read the branch" },
    {
      screenPath: "product/viewer/switcher",
      title: "Choose another reference",
      description:
        "Branches come first with the default at the top, then pull requests; every row carries its publication state.",
    },
    {
      screenPath: "product/viewer/pull-request",
      title: "Open the pull request",
    },
    {
      screenPath: "product/viewer/history",
      title: "Look at what was published before",
      description:
        "Each publication keeps its own immutable link, so an earlier one opens without moving the branch.",
    },
    { screenPath: "product/viewer/share", title: "Copy the link" },
  ],
});
