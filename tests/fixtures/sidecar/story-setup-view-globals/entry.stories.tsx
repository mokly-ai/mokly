import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Setup before view globals",
  render: (_args, { globals }) => (
    <output>{String(globals.theme ?? "uninitialized")}</output>
  ),
} satisfies Meta;

export default meta;
export const Prepared: StoryObj<typeof meta> = {};
