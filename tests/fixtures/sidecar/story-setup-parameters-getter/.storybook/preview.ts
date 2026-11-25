import type { Preview } from "@storybook/react";

let theme = "uninitialized";

export default {
  beforeAll: () => {
    theme = "ready";
  },
  get parameters() {
    return { mokly: { colorSchemes: { dark: { theme } } } };
  },
} satisfies Preview;
