---
title: "Storybook stories"
description: "Use portable React stories as component entries with saved states."
section: "authoring"
order: 12
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
  tags: ["forms"],
  parameters: {
    docs: { description: { component: "Buttons trigger actions." } },
  },
  args: { label: "Continue", disabled: false },
  argTypes: {
    label: { name: "Button label", options: ["Continue", "Save"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
export const Disabled: StoryObj<typeof meta> = {
  name: "Disabled button",
  args: { disabled: true },
};
```

The file supplies one component entry. Its own props come from the meta's
`args`. Each story supplies a variant whose slug is its export name.
The example has paths `components/Button` and `components/Button/Disabled`
under the default `specs` root. The meta title supplies the display title's
last segment. It does not change the path.

The meta can omit `title`. Mokly then uses the component's
`displayName`, else its `name`, else the file name without the stories
extension.

Each variant's title is its story's `name`, else its `storyName`, else
Storybook's start case of the export name. For example, `LargeButton` shows as
`Large Button`. Its slug stays `LargeButton`.

## Story formats

Mokly reads three forms of Storybook's Component Story Format, or CSF:

- **CSF 2:** A default-export meta and function stories with static `args`.
- **CSF 3:** A default-export meta and story objects, as in the example above.
- **CSF Factories:** A meta from `preview.meta()` and stories from
  `meta.story()`, without a default export.

In a factories project, `.storybook/preview` uses `definePreview` from your
Storybook framework package, such as `@storybook/react-vite`:

```ts
// .storybook/preview.ts
import { definePreview } from "@storybook/react-vite";

export default definePreview({});
```

The same component entry can use CSF Factories:

```tsx
// specs/components/Button.stories.tsx
import preview from "../../.storybook/preview";
import { Button } from "./button.js";

const meta = preview.meta({
  title: "Controls/Button",
  component: Button,
  args: { label: "Continue", disabled: false },
});

export const Disabled = meta.story({ args: { disabled: true } });
```

Mokly gets the meta and preview of a factories file from its stories.
The preview's decorators wrap each story. An untitled factories meta uses the
same component and file name fallback.

## Tags and descriptions

Mokly adds its default tag, `mokly`, to Storybook's default `dev` and `test`
tags. Tags combine from the preview, the meta, and the story, in that order.
Mokly includes a story when its combined tags keep both `dev` and `mokly`.

`!dev` hides a story from both Storybook's sidebar and Mokly. Use `!mokly` to
leave it out of Mokly only:

```tsx
export const StorybookOnly: StoryObj<typeof meta> = {
  tags: ["!mokly"],
  args: { label: "Preview only" },
};
```

Put either exclusion tag on the preview, meta, or story. A later tag can add
a removed tag again. Storybook's `includeStories` and `excludeStories` filters
also apply. A file with no included stories gives no entry and no warning.

Custom tags use lowercase kebab-case, such as `forms` or `empty-state`.
The entry gets the custom tags of its first included story in source order.
Each variant gets the custom tags of its own story. Search for `tag:forms` in
the catalogue to filter by that tag. See [Folders and tags](/docs/authoring/collections-and-tags/).

Mokly drops its own `mokly` tag and Storybook's built-in tags, such as `dev`,
`test`, `autodocs`, and `play-fn`. It also drops tags that do not match the tag
grammar, without a warning.

Set `parameters.docs.description.component` to a string for the entry's
description, as in the first example. Mokly uses the value from the first
included story. Each variant keeps that description.

## Props and controls

Mokly infers the schema from data args. `argTypes` supplies control hints:
options, number bounds and step, a label, and help text. It does not supply a
schema or change validation.

Each story keeps the meta's select choices and number bounds, even for an
entry prop that the story does not set. A story's own `argTypes` can override
these hints.

Mokly uses the story's composed `argTypes`, including the types Storybook
infers from arg values. A callback such as `onClick: fn()` stays outside the
data props and schema without a warning. It needs no annotation.

An arg with `control: false`, `table.disable: true`, an `action`, or a
function type also stays outside the data props and schema without a warning.
React element args and arrays of React elements do too. Their file values
remain available to the story. Other non-data args, such as a `Map`, still
give a `props-not-data` warning.

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
