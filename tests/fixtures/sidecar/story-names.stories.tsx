import type { Meta, StoryFn, StoryObj } from "@storybook/react";

function Button() {
  return <button>Names</button>;
}

export default {
  title: "Controls/Names",
  component: Button,
  includeStories: [
    "ExplicitName",
    "LegacyName",
    "LegacyObject",
    "LargeButton",
    "FunctionButton",
    "ExcludedByMeta",
  ],
  excludeStories: ["ExcludedByMeta"],
} satisfies Meta<typeof Button>;

export const ExplicitName: StoryObj<typeof Button> = {
  name: "Explicit Sidebar",
  storyName: "Ignored Alias",
};
export const LegacyName: StoryFn<typeof Button> = () => <Button />;
LegacyName.storyName = "Legacy Sidebar";
export const LegacyObject: StoryObj<typeof Button> = {
  storyName: "Object Sidebar",
};
export const LargeButton: StoryObj<typeof Button> = {};
export function FunctionButton() {
  return <Button />;
}
export const ExcludedByMeta: StoryObj<typeof Button> = {};
export const Helper = () => <Button />;
