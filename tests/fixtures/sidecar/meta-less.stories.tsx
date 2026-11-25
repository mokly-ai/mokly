import type { StoryObj } from "@storybook/react";

export const Primary: StoryObj<{ label: string }> = {
  args: { label: "Primary" },
  render: ({ label }) => <button>{label}</button>,
};
