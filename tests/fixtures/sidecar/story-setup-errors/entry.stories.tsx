import type { Meta, StoryFn, StoryObj } from "@storybook/react";

import { events, setup } from "./state.js";

const meta = {
  title: "Setup/Errors",
  beforeEach: () => setup("meta"),
  render: () => {
    events.push("render");
    return <button>Ready</button>;
  },
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
export const RenderFailure: StoryFn = () => {
  throw new Error("render failed");
};
RenderFailure.story = {
  beforeEach: () => setup("legacy", "cleanup failed after markup"),
};
export const CleanupFailure: Story = {
  beforeEach: [
    () => setup("earlier", "earlier cleanup failed"),
    () => setup("later", "beforeEach cleanup failed"),
  ],
};
export const Prepared: Story = {};
