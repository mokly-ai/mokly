import type { Meta, StoryObj } from "@storybook/react";

let state = "unset";
const events: string[] = [];
const meta = {
  title: "Setup/Before each",
  loaders: [
    async () => {
      await Promise.resolve();
      events.push(`load:${state}`);
      return {};
    },
  ],
  beforeEach: async () => {
    await Promise.resolve();
    state = "ready";
    events.push("setup");
    return async () => {
      await Promise.resolve();
      state = "clean";
      events.push("cleanup");
    };
  },
  afterEach: () => {
    throw new Error("afterEach must not run");
  },
  play: () => {
    throw new Error("play must not run");
  },
  render: () => <output>{`${state}|${events.join(",")}`}</output>,
} satisfies Meta;

export default meta;
export const Prepared: StoryObj<typeof meta> = {};
export const Next: StoryObj<typeof meta> = {};
