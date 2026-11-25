import type { Preview } from "@storybook/react";

export default {
  initialGlobals: { locale: "en" },
  parameters: {
    mokly: {
      viewports: {
        mobile: { theme: "viewport", density: "narrow" },
        desktop: { density: "spacious" },
      },
      colorSchemes: {
        dark: {
          theme: "dark",
          moklyViewport: "override",
          moklyColorScheme: "override",
        },
        light: { theme: "light" },
      },
    },
  },
  decorators: [
    (Story, { globals }) => (
      <section
        data-theme={String(globals.theme)}
        data-density={String(globals.density)}
      >
        <Story />
      </section>
    ),
  ],
} satisfies Preview;
