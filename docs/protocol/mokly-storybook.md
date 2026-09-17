# Storybook Stories As Registered Components

## Delivery Status

This is an approved target tracked by the
[Storybook stories plan](../../plans/storybook-stories.md). Nothing in this
document ships in the current package until that plan marks its milestones
complete. Existing `defineComponent` catalogues are unaffected.

## Product Contract

A consumer that already writes Storybook stories registers them in Mokly
without duplicating variants, controls, or render code. `defineStories` reads
one Component Story Format (CSF) module and returns the same
`RegisteredComponent` that `defineComponent` returns: an `entry` for the
`mockups` export and a typed `Component` wrapper for screens. Stories become
saved variants, argument types become the prop schema and local controls, and
the story render path becomes the render adapter.

Storybook itself never runs. Mokly imports the story module through its own
esbuild consumer graph, so the consumer's Storybook version, framework package,
and bundler are irrelevant. No Storybook package is a dependency or peer of
Mokly. Everything downstream of registration — usage records, Changes
attribution, comparisons, inspection, controls, export — is the existing
[registered component contract](./mokly-components.md) without exception.

## Authoring Boundary

```tsx
import * as ButtonStories from "../../src/components/Button.stories";
import { defineStories } from "@mokly/mokly";

export const button = defineStories(ButtonStories, {
  route: "components/button.html",
  dependencies: [
    "src/components/Button.tsx",
    "src/components/Button.stories.tsx",
  ],
});
export const mockups = [button.entry];
```

`defineStories(module, options)` accepts the module namespace of a CSF2 or CSF3
file. Storybook 9 factory stories created through `preview.meta()` are not
supported; register their underlying CSF module or use `defineComponent`. The
normative option and CSF types are:

```ts
interface StoriesOptions<S extends ObjectPropSchema, Slots> {
  id?: string;
  title?: string;
  description?: string;
  route: string;
  dependencies: readonly string[];
  ownedDependencies?: readonly string[];
  relatedDocs?: readonly string[];
  tags?: readonly string[];
  colorSchemes?: readonly ColorScheme[];
  propSchema?: S;
  controls?: ControlsFor<S>;
  slots?: Slots;
  stories?: readonly string[];
  decorators?: readonly CsfDecorator[];
  globals?: Readonly<Record<string, PropValue>>;
}

interface CsfArgType {
  name?: string;
  description?: string;
  type?:
    | "string"
    | "number"
    | "boolean"
    | "function"
    | { name: string; required?: boolean };
  control?:
    | false
    | CsfControlKind
    | {
        type: CsfControlKind;
        min?: number;
        max?: number;
        step?: number;
        labels?: Record<string, string>;
      };
  options?: readonly PropPrimitive[];
  mapping?: Readonly<Record<string, unknown>>;
  action?: string;
  table?: { disable?: boolean };
}

interface CsfMeta {
  title?: string;
  component?: ComponentType<any>;
  args?: Readonly<Record<string, unknown>>;
  argTypes?: Readonly<Record<string, CsfArgType>>;
  render?: CsfRender;
  decorators?: readonly CsfDecorator[];
  parameters?: Readonly<Record<string, unknown>>;
  includeStories?: RegExp | readonly string[];
  excludeStories?: RegExp | readonly string[];
}

interface CsfStory {
  name?: string;
  storyName?: string;
  args?: Readonly<Record<string, unknown>>;
  argTypes?: Readonly<Record<string, CsfArgType>>;
  render?: CsfRender;
  decorators?: readonly CsfDecorator[];
  parameters?: Readonly<Record<string, unknown>>;
}

type CsfRender = (
  args: Record<string, unknown>,
  context: CsfContext,
) => ReactNode;
type CsfDecorator = (
  Story: (overrides?: { args?: Record<string, unknown> }) => ReactNode,
  context: CsfContext,
) => ReactNode;
```

These are structural subsets. Storybook's `Meta<typeof X>` and `StoryObj`
values satisfy them without importing Mokly types into story files. Fields
outside the subset are ignored, never validated. CSF2 function exports are
stories whose function is the render and whose static `args`, `argTypes`,
`decorators`, `parameters`, and `storyName` properties are read.

## Entry Metadata

`route` and `dependencies` are required; the stories file should be listed so
its edits attribute to the component. Other entry fields resolve in this order:

| Field         | Option                | Fallback                                     |
| ------------- | --------------------- | -------------------------------------------- |
| `id`          | `options.id`          | kebab-case of `meta.title` with `/` as `-`   |
| `title`       | `options.title`       | last `/` segment of `meta.title`             |
| `description` | `options.description` | `meta.parameters.docs.description.component` |
| `tags`        | `options.tags`        | none; Storybook `meta.tags` are not read     |
| `relatedDocs` | `options.relatedDocs` | `[]`                                         |

A missing `meta.title` without an `id` and `title` option, a derived id that is
not a catalogue id, or an absent description fails registration with the story
module's `meta.title` in the diagnostic. All existing id, route, dependency, tag,
and color-scheme validation then applies unchanged.

## Stories To Variants

Every named export except `default` and `__namedExportsOrder` is a candidate
story when it is a plain object or a function. `meta.includeStories` and
`meta.excludeStories` filter candidates with Storybook's semantics. Non-story
exports such as helper constants are ignored only when excluded that way;
an unexcluded object or function export that is not a story is an error.

Ordering is deterministic: `options.stories` when present, else
`__namedExportsOrder`, else export names sorted by code point. `options.stories`
must name existing stories and selects exactly those. The first ordered story
is the default variant.

| Variant field | Source                                                                         |
| ------------- | ------------------------------------------------------------------------------ |
| `id`          | export name in kebab-case (`PrimaryLarge` → `primary-large`)                   |
| `title`       | `story.name`, else `storyName`, else start case of the export                  |
| `description` | `story.parameters.docs.description.story` when present                         |
| `props`       | `{ ...meta.args, ...story.args }` minus action keys, split into data and slots |

Duplicate variant ids, an id that is not a catalogue id, or props that fail the
prop schema fail registration naming the export.

## Prop Schema, Slots, And Actions

`options.propSchema` replaces derivation entirely, and `options.controls` then
follows the existing [controls contract](./mokly-component-controls.md).
Without it, the schema is derived from `meta.argTypes` merged with each story's
`argTypes`, never from argument values. A key is required only when its
`type.required` is `true`. Derivation per key:

| argType                                     | Schema                     | Control            |
| ------------------------------------------- | -------------------------- | ------------------ |
| `boolean` type or control                   | `boolean`                  | boolean            |
| `string` type, `text` or `color` control    | `string`                   | text               |
| `number` type, `number`/`range` control     | `number` with `min`/`max`  | number with `step` |
| `select`/`radio`/`inline-radio` + `options` | `enum` of the options      | select             |
| `check`/`multi-select` + `options`          | `array` of that `enum`     | none               |
| `options` + `mapping`                       | `enum` of the mapping keys | select             |
| `control: false` or `table.disable`         | from `type` only           | none               |
| `object`, `file`, `date`, or no type        | not derivable              | —                  |

Select labels come from `control.labels[value]`, else the option's string form.
Every key that appears in `meta.args` or any story's `args` must be derivable, a
slot, or an action; otherwise registration fails naming the key and directing the
author to `propSchema`. An argType without a matching arg is still part of the
schema. `argTypes.<key>.description` becomes the control description.

`children` is a slot unless an argType declares a derivable data type for it.
`options.slots` replaces that default. Slot values must be renderable React
nodes under the existing slot rules.

An action key is one whose argType has `action`, whose `type` is `function`, or
whose value is a function in every story that supplies it. Action keys are
excluded from the schema, props, material keys, and inspection, and the adapter
passes a shared inert function to the component. A key that mixes function and
data values across stories fails registration. Mokly never fingerprints a
function.

## Rendering

The adapter for a variant is `story.render`, else `meta.render`, else
`(args) => <meta.component {...args} />`; a module with none fails. Before
rendering, every key with `argTypes.<key>.mapping` is replaced by
`mapping[value]`, which is how a preset key resolves to an icon or callback.
Action keys receive the inert function. Slots are passed as React nodes.

Decorators wrap the render inner-to-outer: story decorators, then meta
decorators, then `options.decorators`. `.storybook/preview` is never read; put
provider decorators in `options.decorators` or in the configured renderer.
Each decorator's `Story` argument re-renders with optional `args` overrides.

`CsfContext` is `{ id, name, title, args, argTypes, parameters, globals,
viewport, colorScheme, loaded: {} }`. `parameters` is the shallow merge of
meta and story parameters. `globals` is `options.globals` or `{}`. Render and
decorators must return synchronously; a Promise fails the render. `play`,
`loaders`, `beforeEach`, `mount`, `tags`, and `globals` on stories are ignored.
Browser-only code at module top level fails under the Node consumer graph as
it does for any consumer module.

Local controls edit derived or explicit controls through the existing server
render. Published catalogues keep saved variants read-only.

## Bundling Constraints

Story modules are ordinary consumer modules in the esbuild graph, so they are
protected authoring sources: editing a story rebuilds the catalogue. CSS
imports need a `loaders` entry or alias, and the styles must be declared through
`stylesheets`. Vite `import.meta.env` and Webpack-only globals are not provided.
Imports from Storybook packages resolve through the consumer's `node_modules`
like any dependency; `fn()` from `storybook/test` returns a function and is
handled as an action.

## Related Contracts

- [Registered components](./mokly-components.md)
- [Runtime prop schema](./mokly-component-props.md)
- [Component controls](./mokly-component-controls.md)
- [Component change attribution](./mokly-component-changes.md)
- [Build pipeline](../architecture/build-pipeline.md)
