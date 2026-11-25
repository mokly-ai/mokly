import type { Meta, StoryObj } from "@storybook/react";

function summarize(globals: Record<string, unknown>): string {
  return `${globals.theme}/${globals.density}/${globals.locale}/${globals.moklyViewport}/${globals.moklyColorScheme}`;
}

let hookGlobals: string;
const meta = {
  title: "View globals",
  parameters: { mokly: { viewports: { mobile: { density: "compact" } } } },
  loaders: [({ globals }) => ({ globals: summarize(globals) })],
  beforeEach: ({ globals }) => {
    hookGlobals = summarize(globals);
  },
  render: (_args, { globals, loaded }) => (
    <output>{`loader=${loaded.globals} hook=${hookGlobals} markup=${summarize(globals)}`}</output>
  ),
} satisfies Meta;

export default meta;

export const Themed: StoryObj<typeof meta> = {
  globals: { theme: "story", density: "normal", locale: "fr" },
  parameters: { mokly: { viewports: { desktop: { density: "wide" } } } },
};
