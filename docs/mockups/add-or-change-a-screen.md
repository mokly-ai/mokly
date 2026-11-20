# Add Or Change A Screen

This is the screen authoring guide for the [Mockup catalogue](./README.md).

1. Update the owning protocol first. For a new state, name its purpose and
   the screen or flow from which a reviewer reaches it.
2. Check `@firna/ui` first for common controls, then the registered local
   layouts and illustrations that
   [Shared controls](../protocol/cloud/shared-controls.md) lists. Keep each screen
   in its own component under `src/screens/`; pass the viewport to that
   component for mobile and desktop composition. The renderer applies the
   scheme and the palette to the whole render, so a registered component
   inside a screen takes that screen's palette. Import each registered base
   component's wrapper from its owning design entry, whose default export is
   the `defineComponent` definition. Give a registered component that repeats
   on one screen a stable `moklyInstance` key. Pass a wrapper only the props
   that have a value, also inside a nested object such as a list row, because
   Mokly refuses an `undefined` prop value. Write every drawing to the
   [source policy](../protocol/cloud/mockup-source-policy.md): it reads no clock,
   random value, environment or host module, and each date names its locale
   and time zone. The policy tests also type-check the drawings without Node
   types.
3. Make one `defineScreen` the default export of its path-owning module, with
   title, description, related docs and one `render(props, context)`. The
   render draws the screen's named component for both viewports and passes it
   `context.viewport`. The two email screens are the exception that
   [Mockup catalogue](../protocol/cloud/mockups.md#screen-and-renderer-boundary)
   allows: their render passes no prop, and the email frame reads both axes
   from the render context. A screen with states declares a closed `state` prop
   schema, written `as const`, and `props: { state: "default" }`. Its render
   selects the named component of each state from a `screens` record, so
   TypeScript refuses a state without a component. Declare at most four
   variants, each with a required `slug`, a title and its own
   `props: { state: "<slug>" }`. A further situation is a sibling screen in
   the same folder. List each containing flow in `useCasePaths` on the screen
   or variant the step names. Variants never inherit flow membership.
4. Use `MockLink` for catalogue navigation, with a path or another entry
   module's default export as its target. Use a native link for a real
   external destination. A flow references existing `screenPath` values
   through `defineUseCase`. Never copy a screen tree into a flow.
5. Build, check, test, typecheck and lint, then open every changed generated
   page from disk and every changed flow through Serve.

The entry shape, from `src/entries/product/settings/tokens/index.mockup.tsx`,
shortened to its first variant:

```tsx
import { defineScreen } from "@mokly/mokly";

import {
  SettingsTokensEmptyScreen,
  SettingsTokensErrorScreen,
  SettingsTokensLoadingScreen,
  SettingsTokensScreen,
} from "../../../../screens/product/settings/tokens-pane";

/** The named screen component that each state draws. */
const screens = {
  default: SettingsTokensScreen,
  empty: SettingsTokensEmptyScreen,
  loading: SettingsTokensLoadingScreen,
  error: SettingsTokensErrorScreen,
};

export default defineScreen({
  title: "Publishing tokens",
  description:
    "Publishing tokens — default scenario. Static controls depict the documented action; no live writes occur.",
  relatedDocs: [
    "docs/protocol/cloud/product-mockups.md",
    "docs/protocol/cloud/settings-dialog.md",
  ],
  tags: ["product", "folio", "settings", "default"],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["state"],
    properties: { state: { enum: ["default", "empty", "loading", "error"] } },
  } as const,
  props: { state: "default" },
  render: ({ state }, context) => {
    const Screen = screens[state];
    return <Screen viewport={context.viewport} />;
  },
  variants: [
    {
      slug: "empty",
      title: "Publishing tokens · Empty",
      description:
        "Publishing tokens — empty scenario. Static controls depict the documented action; no live writes occur.",
      tags: ["product", "folio", "settings", "empty"],
      props: { state: "empty" },
    },
  ],
});
```

`defineScreen` returns one definition that carries its variants. A variant
has no render of its own: Mokly runs the parent's render with the variant's
props, which replace the parent's top-level props, so the `state` prop
selects the state's screen component. A variant derives its path from the
parent and inherits description, address, color schemes, related docs and
tags unless it sets its own. A screen without states declares no props, and
its render passes `context.viewport` to its one component. No entry lists
its dependencies, because Mokly derives the inputs of each render from the
module's imports. The same component renders in the desktop dialog and the
mobile layer; `SettingsSurface` chooses the frame from the viewport.
The [composition guide](./composition.md) lists the shared screen components,
styles, fixtures and controls; the
[product inventory](../protocol/cloud/product-mockups.md) owns paths and state
coverage.
