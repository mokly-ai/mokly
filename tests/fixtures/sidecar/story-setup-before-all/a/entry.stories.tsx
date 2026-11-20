import type { Meta, StoryObj } from "@storybook/react";

import { loadSetup } from "./state.js";

const meta = {
  title: "Setup/Before all A",
  loaders: [loadSetup],
  render: (_args, { loaded }) => (
    <output>{String(loaded.setup ?? "not loaded")}</output>
  ),
} satisfies Meta;

export default meta;
export const Prepared: StoryObj<typeof meta> = {};
