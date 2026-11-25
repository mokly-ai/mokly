import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";

export default { title: "Controls/Story Args" } satisfies Meta;

export const Mapped: StoryObj<{ icon: ReactNode }> = {
  args: { icon: "arrow" },
  argTypes: {
    icon: {
      control: "select",
      options: ["arrow", "check", "label"],
      mapping: { arrow: <i>Arrow</i>, check: <b>Check</b> },
    },
  },
  loaders: [({ args }) => ({ loader: args.icon })],
  beforeEach: ({ args, loaded }) => {
    loaded.hook = args.icon;
  },
  decorators: [
    (Story, { args }) => (
      <section>
        <span>{args.icon}</span>
        <Story />
      </section>
    ),
  ],
  render: ({ icon }, { loaded }) => (
    <output>
      <span>{loaded.loader}</span>
      <span>{loaded.hook}</span>
      <span>{icon}</span>
    </output>
  ),
};

interface ConditionalArgs {
  mode: string | { advanced: boolean };
  detail?: string;
  hint?: string;
}

function visibleArgs(args: ConditionalArgs): string {
  return [
    Object.hasOwn(args, "detail") ? args.detail : "absent",
    Object.hasOwn(args, "hint") ? args.hint : "absent",
  ].join("/");
}

export const Conditional: StoryObj<ConditionalArgs> = {
  args: { mode: "basic", detail: "Extra", hint: "Dark hint" },
  argTypes: {
    mode: { mapping: { basic: { advanced: false }, full: { advanced: true } } },
    detail: { if: { arg: "mode", eq: { advanced: true } } },
    hint: { if: { global: "moklyColorScheme", eq: "dark" } },
  },
  loaders: [({ args }) => ({ loader: visibleArgs(args) })],
  beforeEach: ({ args, loaded }) => {
    loaded.hook = visibleArgs(args);
  },
  render: (args, { loaded }) => (
    <output>{`loader=${loaded.loader} hook=${loaded.hook} render=${visibleArgs(args)}`}</output>
  ),
};

let mappingReads = 0;

export const ChangingMapping: StoryObj<{ value: string }> = {
  args: { value: "selected" },
  argTypes: {
    value: {
      options: ["selected"],
      mapping: {
        get selected() {
          return `m${++mappingReads}`;
        },
      },
    },
  },
  loaders: [({ args }) => ({ loader: args.value })],
  beforeEach: ({ args, loaded }) => {
    loaded.hook = args.value;
  },
  decorators: [
    (Story, { args }) => (
      <section data-value={args.value}>
        <Story />
      </section>
    ),
  ],
  render: ({ value }, { loaded }) => (
    <output>{`loader=${loaded.loader} hook=${loaded.hook} render=${value}`}</output>
  ),
};

export const WrittenArgs: StoryObj<{ label: string }> = {
  args: { label: "Saved" },
  loaders: [
    ({ args }) => {
      args.label = "Loaded";
    },
  ],
  beforeEach: ({ args }) => {
    args.label += " and hooked";
  },
  decorators: [
    (Story, { args }) => (
      <section data-label={args.label}>
        <Story />
      </section>
    ),
  ],
  render: ({ label }) => <output>{label}</output>,
};
