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
  args: { label: "Continue" },
  argTypes: {
    label: { name: "Button label", options: ["Continue", "Save"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
export const Default: StoryObj<typeof meta> = { args: { label: "Save" } };
export const Disabled: StoryObj<typeof meta> = {
  name: "Disabled button",
  args: { disabled: true },
};
```

The first included story in source order becomes the component entry's parent
page. Its data args supply the entry's props. Each other included story
renders as a variant at the entry path plus its export name. Under the default
`specs` root, `Default` renders at `components/Button`. `Disabled` renders at
`components/Button/Disabled`. Mokly does not repeat `Default` as a variant.

Mokly does not render a page for the meta itself, so the meta's `args` do not
need to be complete. The last segment of the meta's `title` gives the entry's
display title. It does not change the path. If the meta omits `title`, Mokly
uses the component's `displayName`, else its `name`, else the file name
without the stories extension.

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
  args: { label: "Continue" },
});

export const Default = meta.story({ args: { label: "Save" } });
export const Disabled = meta.story({ args: { disabled: true } });
```

Mokly gets the meta and preview of a factories file from its stories.
The preview's decorators wrap each story. An untitled factories meta uses the
same component and file name fallback.

## Tags and descriptions

Mokly adds its default tag, `mokly`, to Storybook's default `dev` and `test`
tags. Tags combine from the preview, the meta, and the story, in that order.
Mokly includes a story when its combined tags keep both `dev` and `mokly`.

`!dev` hides a story from both Storybook's sidebar and Mokly. Add `!mokly`
to leave a story out of the Mokly catalogue while keeping it in Storybook.

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

Each story starts with the data args that Storybook composes for it, including
shared args from the meta. A variant does not inherit props from the parent
page. In the example, `Default` sets `label` to `"Save"`. `Disabled` keeps
`"Continue"` from the meta.

Mokly infers one prop schema from all included stories. A top-level prop is
required only when every included story sets it. In the example, `label` is
required and `disabled` is optional.

`argTypes` supplies control hints such as options, number bounds and step,
a label, and help text. It does not supply a schema or change validation.

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

Mokly starts each render with exactly the data props it shows for that story.
If you unset an optional prop in `mokly serve`, the story renders without it.
Non-data args start with the values the file defines. As in Storybook's
preview, `argTypes.mapping` supplies mapped control values to the component
and `argTypes.if` omits args whose conditions are false.

## Use story components in screens

Mokly records a use when a screen, product component, or story renders the
`component` from a stories meta in JSX that Mokly compiles. This also works
through `memo` or `forwardRef`. Use the same JSX as in the product.
A stories entry's own pages record only uses of other story components.
For a `defineComponent` wrapper, follow the [wrapper rules](/docs/authoring/components/#use-the-wrapper).

### Name repeated uses

Give each repeated use a `key` that is unique among its siblings.
For a stories entry at `components/button`, Mokly gives these uses the ids
`button-save` and `button-cancel`.

```tsx
// specs/profile/edit.mockup.tsx
import { defineScreen } from "@mokly/mokly";
import { Button } from "../components/button.js";

export const edit = defineScreen({
  title: "Edit profile",
  description: "Save or cancel profile edits.",
  relatedDocs: [],
  render: () => (
    <>
      <Button key="save" label="Save" />
      <Button key="cancel" label="Cancel" />
    </>
  ),
});
```

Without a usable `key`, Mokly tries `id`, `name`, `data-testid`, then
`aria-label` by default. Set `instanceNameProps` in `mokly.config.json` to
change the list. Mokly appends the first name it finds in lowercase
kebab-case to the last segment of the stories entry's path. Without a name,
Mokly uses the last segment alone.

If an id repeats in one input scope, Mokly adds the first free number from 2,
such as `button-2`. Each numbered use gives an `instance-numbered` warning.
`mokly build --strict` fails on this warning. Give the numbered use a `key`
that yields a unique id in that scope.

### Compare supplied content

By default, Mokly gives each element in `children` or another prop its own
slot. Changes compares each slot in the screen that supplied it. Changes
shows the component's own render edits once, on its page. Changes compares
data props such as string children. The recorded inputs omit function props.

If `Card` is a story component, Changes keeps this paragraph in the screen's
comparison.

```tsx
<Card>
  <p>Your changes are ready to save.</p>
</Card>
```

### Keep React element types

Mokly keeps the type of each component it compiles from your project. Define
the component at the top level of a module under a name or as a default export.
A check such as `child.type === Tab` then works as in the product.
`Children.toArray`, `Children.only`, Radix `asChild`, and string children also
work as in the product.

Supplied HTML elements and elements from installed packages render through
Mokly elements. A story component that Mokly cannot compile, such as one
defined as an object member, also renders through a Mokly element.

If your component checks the type of a child that gets a Mokly element, set
`parameters: { mokly: { contentSlots: false } }` on its meta. The first
included story's composed parameters set this field for the whole entry.
This turns off content slots and their Mokly elements. The component's page
still lists its uses. Changes compares its rendered output on each screen
that uses it.

### JSX that records no use

Mokly skips these elements at the call site.

- An element from a `createElement` call.
- JSX with a `key` after a spread. Put the `key` before the spread.
- Compiled JSX from an installed package.

An element in this list can still record a use as content of another use.
Mokly must compile its story component and keep content slots enabled.

A class component with an explicit `ref` records no use. With an explicit
`ref`, a compiled `forwardRef` use has no record if it shares that ref and
equal props with another use. It also has no record if other code changes its
props before it renders.

An element that records no use renders normally. Its output stays in the
comparison of the screen or component that renders it.

## Decorators and themes

Mokly loads the consumer's `.storybook/preview` annotations and uses
Storybook's portable story composition. Storybook decorators wrap the story.
The configured Mokly renderer wraps React mockup screens and components.
Stories use their Storybook providers.

A decorator can read the globals `moklyViewport` and `moklyColorScheme` to
select a layout or product theme. Mokly creates a view of each included story
for every combination of viewport and enabled color scheme.

Use the `mokly` parameter to set Storybook globals for each view. The
`colorSchemes` field maps `light` or `dark` to an object of globals. The
`viewports` field maps `mobile` or `desktop` to an object of globals. Set
or override the parameter in the preview, the meta, or the story. Mokly
reads the composed parameters for each story.

Mokly starts with the story's composed globals and applies these values in
order. Later values win when they set the same global.

1. The mapped globals for the view's viewport.
2. The mapped globals for the view's color scheme.
3. The values of `moklyViewport` and `moklyColorScheme` for the view.

This preview's theme decorator reads `globals.theme`. It sets
`data-theme="dark"` on the story wrapper in dark views.

```tsx
// .storybook/preview.tsx
import type { Preview } from "@storybook/react";

const preview = {
  decorators: [
    (Story, { globals }) => (
      <div data-theme={globals.theme === "dark" ? "dark" : "light"}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    mokly: {
      colorSchemes: { dark: { theme: "dark" }, light: { theme: "light" } },
    },
  },
} satisfies Preview;

export default preview;
```

Mokly applies the valid mappings and ignores malformed values. Examples
include the unknown field `colourSchemes`, the unknown view name `tablet`,
and a string where the mapping expects a globals object. The build gives a
`storybook-parameter-ignored` warning that names the story page and the
ignored value's path. `mokly build --strict` fails on this warning.

Consumer JavaScript runs during static rendering. It does not run in the
catalogue's frames. Use data args and static component output for the states
you want to show.

## Loaders and hooks

Before each story render, Mokly runs the story's loaders and `beforeEach`
hooks. They get the same args as the render. These are the story's own
non-data args and exactly the data props the preview shows. When you edit a
prop in `mokly serve`, the loaders and hooks see the new value. When you unset
an optional prop, Mokly leaves it out of the args. If a loader or a
`beforeEach` hook changes the story's args, the decorators and the render
get the updated args, as in Storybook's preview.

The render receives the loader results through `loaded`. This story uses
`Button` and `meta` from the first example.

```tsx
export const Loaded: StoryObj<typeof meta> = {
  loaders: [async () => ({ label: "Ready" })],
  render: (args, { loaded }) => <Button {...args} label={loaded.label} />,
};
```

A `beforeEach` hook can return a cleanup function to undo its setup before
another story or screen renders. Mokly runs the cleanups once each, in reverse
order, at the end of the story render whose hooks returned them. It runs them
even if a loader, a hook, or the render fails. If a `beforeEach` cleanup
throws, it fails that render. Storybook's own preview runs a story's cleanups
when the next story loads.

The preview's `beforeAll` hook runs before the first story render of a
build. Each render process keeps one active setup. When rebuilt stories render
in the same process, Mokly runs the old setup's cleanup before `beforeAll` runs
again. This can happen in `mokly serve` after an edit.

Mokly sets `moklyViewport` and `moklyColorScheme` before the loaders and hooks
run. Loaders and `beforeEach` hooks can read them from `context.globals`.

If `beforeAll` throws during a build, Mokly reuses that error for each story
render that needs the setup. Mokly runs no `play` function or `afterEach` hook.

Loaders and hooks run in Node during the static render.

## When a story cannot render

If story composition, a loader, a hook, a cleanup, or the render throws, Mokly
shows an error document in each affected view. The build continues with the
other stories.

The error document names the story. It shows the failure reason with absolute
paths removed. It uses only its own styles. Its colors follow the view's light
or dark scheme.

The error document tells you to add `!mokly` to leave the story out of the
catalogue. See [Tags and descriptions](/docs/authoring/storybook/#tags-and-descriptions).

`mokly build` prints one `story-render-failed` warning for each failed view.
For example, a story that renders a portal into `document.body` gives this
warning:

```text
[mokly/warning] Portal/index.desktop.html: story "specs/Portal.stories.tsx#Portal" could not render; add the "!mokly" tag to leave it out: document is not defined
```

`mokly build --strict` and `mokly publish --strict` fail on this warning. A
render timeout or crash stops the build. An error in Mokly's own components
and helpers still stops the build. Invalid props for a `defineComponent`
wrapper are one example.

Use code that can render on the server without browser APIs such as `window`
or `document`.

In `mokly serve`, the story's frames show the error document. If rendering
edited props fails, the Props tab shows a failure alert.

In Changes, a failed view counts as a change if it rendered on the other
side. If the two error documents are equal, for example because the story
keeps its name and fails again with the same reason, Changes shows the view
as unchanged.
