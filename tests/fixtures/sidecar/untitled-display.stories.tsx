import type { Meta, StoryFn } from "@storybook/react";

function Button() {
  return <button>Display</button>;
}
Button.displayName = "Display Button";

export default { component: Button } satisfies Meta<typeof Button>;
export const Primary: StoryFn<typeof Button> = () => <Button />;
