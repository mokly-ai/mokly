import type { Meta, StoryObj } from "@storybook/react";

export default {
  title: "Describe Failure",
  render: () => <button>Ready</button>,
} satisfies Meta;

export const Broken = {
  get args(): never {
    throw new Error("fixture story args failed");
  },
} satisfies StoryObj;
