import type { Meta, StoryObj } from "@storybook/react";

function Button(props: { label: string; action?: () => void }) {
  return (
    <button>
      {props.label}
      {typeof props.action === "function" ? " callback" : ""}
    </button>
  );
}
const meta = {
  title: "Controls/Button",
  component: Button,
  args: { label: "Story", action: () => {} },
  argTypes: {
    label: { name: "Button label", options: ["Story", "Other"] },
    action: { control: false },
  },
} satisfies Meta<typeof Button>;
export default meta;
export const Primary: StoryObj<typeof meta> = { args: { label: "Primary" } };
