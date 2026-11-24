import type { Meta, StoryObj } from "@storybook/react";

let loads = 0;
const meta = {
  title: "Setup/Loader",
  render: (_args, { loaded }) => (
    <output>{String(loaded.label ?? "not loaded")}</output>
  ),
} satisfies Meta;

export default meta;
export const Prepared: StoryObj<typeof meta> = {
  loaders: [
    async ({ globals }) => {
      await Promise.resolve();
      return {
        label: `Loaded ${++loads}:${globals.moklyViewport}:${globals.moklyColorScheme}`,
      };
    },
  ],
};
