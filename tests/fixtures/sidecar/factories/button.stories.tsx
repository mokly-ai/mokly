import preview from "./.storybook/preview.js";

function Button(props: { label: string }) {
  return <button>{props.label}</button>;
}

const meta = preview.meta({
  title: "Controls/Factory Button",
  component: Button,
  args: { label: "Meta" },
});

export const Primary = meta.story({
  args: { label: "Primary" },
  decorators: [
    (Story) => (
      <strong>
        <Story />
      </strong>
    ),
  ],
});
export const Secondary = meta.story({ args: { label: "Secondary" } });
