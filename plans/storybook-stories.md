# Storybook Stories As Registered Components

Status: active; contract approved, implementation not started. Rebased onto
`origin/main` at `37a5ea8` after the Mokly rename and viewer extraction.

Implement the [Storybook stories contract](../docs/protocol/mokly-storybook.md):
a `defineStories` authoring helper that adapts one Component Story Format (CSF)
module into the existing `RegisteredComponent` shape. Stories become saved
variants, `argTypes` become the prop schema and local controls, and the story
render path plus decorators become the render adapter.

The central rule is that Storybook never runs. Story modules are ordinary
consumer modules in the esbuild graph, and everything after registration is the
unchanged [registered component contract](../docs/protocol/mokly-components.md).
No Storybook package becomes a dependency or peer of Mokly.

Out of scope: Storybook 9 factory stories from `preview.meta()`, reading
`.storybook/preview`, `play` functions, async renders, a browser runtime, and
Storybook `tags` or `globals` on stories.

## Execution Rules

Keep the existing catalogue functioning after every milestone. Backend
milestones are exercised through unit tests and internal fixtures until the
public export lands in the integration milestone. Do not export `defineStories`
from the package root before its validation, derivation, and rendering are
complete and tested.

For regressions, add the failing test before fixing the implementation. Keep
source files near 200 lines and below 300; split modules rather than growing
them. Run focused tests after each unit and run `cargo xtask check` before each
milestone's commit. Any newly discovered TODO is added under its milestone.

## Milestone 1: Define the contract — completed

Record the agreed behavior before implementation.

- [x] Inspect `defineComponent`, the prop schema, controls, wrapper, inputs, and
      the esbuild consumer graph to confirm the adapter shape.
- [x] Write [`docs/protocol/mokly-storybook.md`](../docs/protocol/mokly-storybook.md)
      covering authoring, entry metadata, story-to-variant mapping, schema and
      control derivation, slots, actions, rendering, decorators, and bundling.
- [x] Create and index this plan; link it from the protocol index.
- [x] Validate changed Markdown with `npm run format:check` and review the diff.
- [x] Commit `docs: add Storybook stories contract and plan` and push.

## Milestone 2: CSF module reading and story selection

Deliver a pure module that turns a CSF namespace into ordered story records
without touching rendering. Nothing is exported publicly yet.

- [ ] Add `src/components/storybook/csf_types.ts` with the structural
      `CsfMeta`, `CsfStory`, `CsfArgType`, `CsfRender`, `CsfDecorator`, and
      `CsfContext` subsets from the contract.
- [ ] Add `src/components/storybook/module.ts`: read `default`, apply
      `includeStories`/`excludeStories` with Storybook semantics, reject
      unexcluded non-story exports, and accept CSF2 function exports with
      static `args`, `argTypes`, `decorators`, `parameters`, and `storyName`.
- [ ] Add `src/components/storybook/order.ts`: `options.stories`, then
      `__namedExportsOrder`, then code-point sort; validate that
      `options.stories` names existing stories.
- [ ] Add `src/components/storybook/naming.ts`: export name to kebab-case
      variant id, `name`/`storyName`/start-case title, `meta.title` to id and
      title, and `parameters.docs.description` extraction.
- [ ] Tests in `tests/storybook_module.test.ts`: CSF2 and CSF3 fixtures,
      include/exclude, ordering precedence, duplicate ids, non-catalogue ids,
      missing `meta.title`, and non-story exports.
- [ ] Run focused tests, then `cargo xtask check`; commit
      `feat(components): read Storybook CSF modules` and push.

## Milestone 3: Schema, controls, slots, and actions derivation

Deliver derivation from `argTypes` and args into the existing prop schema and
control types, including the explicit `propSchema` override path.

- [ ] Add `src/components/storybook/arg_types.ts`: merge meta and story
      `argTypes`; classify each key as data, slot, action, or not derivable per
      the contract table; produce `DataPropField` and `ComponentControl` from `@mokly/viewer`.
- [ ] Add `src/components/storybook/actions.ts`: detect action keys by
      `action`, `type: "function"`, or function values in every supplying story;
      fail on keys that mix function and data values.
- [ ] Add `src/components/storybook/props.ts`: merge `meta.args` and
      `story.args`, strip action keys, split slots from data, and validate the
      result through the existing `componentInputs` path.
- [ ] Wire `options.propSchema` and `options.controls` to bypass derivation,
      and `options.slots` to replace the `children` default.
- [ ] Tests in `tests/storybook_derivation.test.ts`: every row of the
      derivation table, `mapping` enums, select labels, required detection,
      underivable keys naming the key, `fn()`-style actions, mixed action keys,
      explicit `propSchema` override, and `children` slot defaulting.
- [ ] Run focused tests, then `cargo xtask check`; commit
      `feat(components): derive schemas from Storybook argTypes` and push.

## Milestone 4: Render adapter and decorators

Deliver the adapter that renders a variant through the story render path,
decorators, mapping, and the inert action function, then compose everything
into `defineStories`.

- [ ] Add `src/components/storybook/render.tsx`: select `story.render`,
      `meta.render`, or `meta.component`; apply `mapping`; pass the shared
      inert function for actions; build `CsfContext`; reject Promise results.
- [ ] Add `src/components/storybook/decorators.tsx`: wrap story, meta, and
      option decorators inner-to-outer with `Story` re-render and `args`
      overrides.
- [ ] Add `src/components/storybook/define.ts` exporting `defineStories`,
      which assembles a `ComponentInput` and delegates to
      `validateComponentDefinition`, `renderInstance`, and
      `registerComponentWrapper` so the returned value is a real branded
      `RegisteredComponent` that usage collection recognizes.
- [ ] Tests in `tests/storybook_render.test.tsx`: render precedence,
      mapping resolution, action inertness, decorator order, `Story` overrides,
      context fields, Promise rejection, and usage records when a screen renders
      `<stories.Component />`.
- [ ] Extend `tests/component_authoring_types.tsx` with `defineStories`
      typing checks against `Meta`/`StoryObj`-shaped literals.
- [ ] Run focused tests, then `cargo xtask check`; commit
      `feat(components): render Storybook stories as variants` and push.

## Milestone 5: Public API, example, docs, and smoke

Expose the helper, prove it in the example catalogue and packed consumers, and
align documentation.

- [ ] Export `defineStories` and `StoriesOptions` plus the CSF types from
      `src/index.ts`.
- [ ] Add `examples/basic/entries/components/badge.stories.tsx` as a plain
      CSF3 module and register it from a new `badge.tsx` entry; render it in an
      existing example screen; run `npm run example:build` and commit the
      generated output.
- [ ] Add a CSF consumer case to `scripts/package/consumer_cases.mjs` so
      `npm run package:smoke` covers a packed consumer importing a stories file.
- [ ] Add a browser test asserting the badge page lists its story variants and
      that a derived control edits the preview in Serve.
- [ ] Update the protocol Delivery Status, `docs/protocol/README.md`,
      `src/components/README.md`, and the root README feature summary, Key
      Code, and Related Docs entries.
- [ ] Smoke: run `npm run dev`, open the badge page, switch variants, edit a
      control, confirm the story file appears in Changes after an edit.
- [ ] Run `cargo xtask check`; commit `feat: register Storybook stories as components`
      and push.
- [ ] Move this plan to the completed section of `plans/README.md`.

## Milestone 6: Review

- [ ] After the final push, review the complete local diff against
      `origin/main` using
      [`docs/implementation-review-prompt.md`](../docs/implementation-review-prompt.md).
      Report numbered findings with severity, context, impact, lettered
      options, and a recommendation; do not change the implementation.
