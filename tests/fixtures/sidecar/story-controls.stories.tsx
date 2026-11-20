import type { Meta, StoryFn, StoryObj } from "@storybook/react";

function Button(props: { label: string; size?: string }) {
  return <button data-size={props.size}>{props.label}</button>;
}

const meta = {
  title: "Controls/Story Controls",
  component: Button,
  args: { label: "Meta" },
  argTypes: { size: { options: ["small", "large"] } },
} satisfies Meta<typeof Button>;
export default meta;

export const WithSize: StoryObj<typeof meta> = { args: { size: "small" } };
export const WithoutSize: StoryFn<typeof Button> = (args) => (
  <Button {...args} />
);
WithoutSize.args = { label: "Without size" };
WithoutSize.argTypes = { size: { name: "Optional size" } };
