import type { Meta, StoryObj } from "@storybook/react";

function Button() {
  return <button>Excluded</button>;
}

export default { component: Button } satisfies Meta<typeof Button>;
export const HiddenDev: StoryObj<typeof Button> = { tags: ["!dev"] };
export const HiddenMokly: StoryObj<typeof Button> = { tags: ["!mokly"] };
