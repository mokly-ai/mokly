import type { Meta, StoryObj } from "@storybook/react";

interface Args {
  label: string;
  note?: string;
}

function summarize(args: Args): string {
  return `${args.label}/${Object.hasOwn(args, "note") ? args.note : "absent"}`;
}

let hookArgs: string;
const meta = {
  title: "Setup/Args",
  args: { label: "Saved", note: "Saved note" },
  loaders: [({ args }) => ({ args: summarize(args) })],
  beforeEach: ({ args }) => {
    hookArgs = summarize(args);
  },
  render: (args, { loaded }) => (
    <output>{`loader=${loaded.args} hook=${hookArgs} markup=${summarize(args)}`}</output>
  ),
} satisfies Meta<Args>;

export default meta;
export const Prepared: StoryObj<typeof meta> = {};
