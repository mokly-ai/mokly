import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "CommonJS mixed preview",
  render: (_args, { globals, loaded }) => (
    <output>{`${loaded.message}:${globals.locale}:${globals.theme}`}</output>
  ),
} satisfies Meta;

export default meta;
export const Primary: StoryObj<typeof meta> = {};
