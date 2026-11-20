import type { Meta, StoryObj } from "@storybook/react";

const meta = {
  title: "Setup/Errors",
  render: () => <button>Ready</button>,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const LoaderFailure: Story = {
  loaders: [
    async () => {
      await Promise.resolve();
      throw new Error("loader failed");
    },
  ],
};
export const BeforeEachFailure: Story = {
  beforeEach: async () => {
    await Promise.resolve();
    throw new Error("beforeEach failed");
  },
};
export const RenderFailure: Story = {
  render: () => {
    throw new Error("render failed");
  },
};
export const CleanupFailure: Story = {
  beforeEach: () => async () => {
    await Promise.resolve();
    throw new Error("beforeEach cleanup failed");
  },
};
export const Prepared: Story = {};
