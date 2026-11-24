import type { Meta, StoryObj } from "@storybook/react";

function Button(props: { value?: unknown; mixed?: unknown[] }) {
  return <button>{String(props.value)}</button>;
}

export default { component: Button } satisfies Meta<typeof Button>;
export const Unsupported: StoryObj<typeof Button> = {
  args: {
    value: new Map([["not", "data"]]),
    mixed: [<i key="icon" />, "text"],
  },
};
