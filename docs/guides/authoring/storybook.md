---
title: "Storybook stories"
description: "Use portable React stories as component entries with saved states."
section: "authoring"
order: 11
---

## Add a stories file

A root can match `*.stories.ts`, `*.stories.tsx`, `*.stories.js`, or
`*.stories.jsx`. Default root patterns include them. Install `@storybook/react`
in the consumer repository when you use this form.

```tsx
// specs/components/Button.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button.js";

const meta = {
  title: "Controls/Button",
  component: Button,
  args: { label: "Continue", disabled: false },
  argTypes: {
    label: { name: "Button label", options: ["Continue", "Save"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
export const Disabled: StoryObj<typeof meta> = {
  args: { disabled: true },
};
```

The file supplies one component entry. Its own props come from the meta's
`args`. Each story supplies a variant whose slug is its export name.
The example has paths `components/Button` and `components/Button/Disabled`
under the default `specs` root. The meta title supplies the display title's
last segment. It does not change the path.

## Props and controls

Mokly infers the schema from data args. `argTypes` supplies control hints:
options, number bounds and step, a label, and help text. It does not supply a
schema or change validation.

An arg with `control: false`, `table.disable: true`, an `action`, or a
function type stays outside the data props and schema. Its file value remains
available to the story. Use these annotations for callbacks.
A function arg without an annotation is excluded with a `props-not-data`
warning.

Saved states use Storybook's composed args. Live data props overlay those args.
Non-data args keep the values the file defines.

## Decorators and themes

Mokly loads the consumer's `.storybook/preview` annotations and uses
Storybook's portable story composition. Storybook decorators wrap the story.
The configured Mokly renderer wraps React mockup screens and components;
stories use their Storybook providers.

A decorator can read the globals `moklyViewport` and `moklyColorScheme` to
select a layout or product theme. Each story renders for the catalogue's
viewports and enabled color schemes.

Consumer JavaScript runs during static rendering. It does not enter the
catalogue's browser frames. Use data args and static component output for the
states you want to show.
