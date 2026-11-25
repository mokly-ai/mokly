import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Ordinary Story",
  render: () => <button>Ordinary story</button>,
} satisfies Meta;

export default meta;
export const Primary: StoryObj<typeof meta> = {};
