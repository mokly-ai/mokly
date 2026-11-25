import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Setup before reading preview parameters",
  render: (_args, { globals }) => <output>{String(globals.theme)}</output>,
} satisfies Meta;

export default meta;
export const Prepared: StoryObj<typeof meta> = {};
