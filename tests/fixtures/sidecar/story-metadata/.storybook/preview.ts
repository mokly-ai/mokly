import type { Preview } from "@storybook/react";

export default {
  tags: ["preview-tag", "!dev"],
  parameters: { docs: { description: { component: "Preview description" } } },
} satisfies Preview;
