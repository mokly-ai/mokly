import { __definePreview } from "@storybook/react";

export default __definePreview({
  addons: [],
  decorators: [
    (Story) => (
      <section data-preview="factory">
        <Story />
      </section>
    ),
  ],
});
