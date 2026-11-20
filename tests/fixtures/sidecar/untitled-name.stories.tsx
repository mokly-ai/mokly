import type { Meta, StoryObj } from "@storybook/react";

function NamedButton() {
  return <button>Named</button>;
}

export default { component: NamedButton } satisfies Meta<typeof NamedButton>;
export const Primary: StoryObj<typeof NamedButton> = {};
