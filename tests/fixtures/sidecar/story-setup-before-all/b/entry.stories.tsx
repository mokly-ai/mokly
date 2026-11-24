import preview from "./.storybook/preview.js";
import { loadSetup } from "./state.js";

const meta = preview.meta({
  title: "Setup/Before all B",
  loaders: [loadSetup],
  render: (_args, { loaded }) => (
    <output>{String(loaded.setup ?? "not loaded")}</output>
  ),
});

export const Prepared = meta.story({});
