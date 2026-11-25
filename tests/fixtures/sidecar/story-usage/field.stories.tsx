import { __definePreview } from "@storybook/react";

import { ForwardField } from "./controls.js";

const meta = __definePreview({ addons: [] }).meta({
  title: "Field",
  component: ForwardField,
});
export const Default = meta.story({ args: { label: "Own" } });
