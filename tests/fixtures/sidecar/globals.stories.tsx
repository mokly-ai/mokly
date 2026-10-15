import type { Meta, StoryObj } from "@storybook/react";

function Button(props: { label: string }) {
  return <button>{props.label}</button>;
}
const meta = {
  component: Button,
  args: { label: "Globals" },
  decorators: [
    (Story, context) => (
      <section
        data-viewport={String(context.globals.moklyViewport)}
        data-scheme={String(context.globals.moklyColorScheme)}
      >
        <Story />
      </section>
    ),
  ],
} satisfies Meta<typeof Button>;
export default meta;
export const Primary: StoryObj<typeof meta> = {};
