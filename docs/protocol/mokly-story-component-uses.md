# Story Component Uses

Status: Mokly does not record story component uses yet. The [story component usage milestone](../../plans/storybook-support.md#milestone-35-story-component-usage) adds them.

This page continues the [instance contract](./mokly-instances.md). It defines
the uses of story components, the id of each use, and the
`instance-numbered` warning.

## Story Components

A story component is the `component` of the meta of a
[stories entry](./mokly-storybook.md#the-entry-and-its-variants), in every
[form of stories file](./mokly-storybook.md#stories-files) that Mokly reads. A
use of a story component is a rendered JSX element, in a module that Mokly
compiles with esbuild or under the [Vite adapter](./mokly-vite-adapter.md),
whose type is the component. An element is also a use when its type or the
story component is a `memo` or `forwardRef` object whose inner component is
the other one, such as `memo(Button)` for the story component `Button`.

Each use is an instance of the stories entry under the
[instance contract](./mokly-instances.md#identity-and-scope), in the render
of a screen, a component, or a story. When the metas of several stories
entries name one component, its uses are instances of the entry whose path
sorts first in lexical order. A `defineComponent` wrapper keeps its own
instance rules, also when a meta names it. Decision: the first path gives
both sides of a comparison the same entry, and a wrapper already records its
own instance.

## Pages Of A Stories Entry

On the pages of a stories entry, a use of the entry's own story component is
not an instance. A use of another story component there is an instance, as in
a screen. Decision: such a page compares the component itself, and an
instance region would hide the component's own render edits from Changes.

## Compiled JSX Only

An element from a `createElement` call is not a use, and neither is JSX that
an installed package ships compiled. An element whose `key` follows a spread,
such as `<Card {...item} key={item.id} />`, is not a use either, because the
compilers turn it into a `createElement` call. With the `key` before the
spread, the element is a use. Decision: only compiled JSX gives uses, because
the [JSX development shim](./mokly-sidecar.md#bundling) sees it on both
compile paths.

## Ids

The id of a use comes from the first of these that gives a value: its `key`,
then each naming prop in the order of the
[`instanceNameProps`](./mokly-configuration.md#instance-name-props)
configuration field. A string or a finite number gives a value when its
kebab-case form below is not empty. A number counts as the text that
JavaScript's `String` gives it. The id is the final segment of the stories
entry's resolved path, a hyphen, and the kebab-case form of the value. For
example, `key="Save"` on a use of `ui/button` gives `button-save`. Without a
value, the id is the segment alone, such as `button`. The segment keeps its
case, and every such id follows the
[segment grammar](./mokly-paths.md#segment-grammar).

The kebab-case form of a value comes from four steps:

1. Letters lose their accents: the text takes its canonical decomposition,
   and the combining marks drop out.
2. Letters become lowercase.
3. Each run of characters other than `a` to `z` and `0` to `9` becomes one
   hyphen.
4. The ends lose their hyphens.

So `Café` gives `cafe`, and `Save draft` gives `save-draft`.

Decision: the id comes from `key` and the naming props, because authors
already keep their values stable for lists, tests, and accessibility. The
segment keeps the uses of two components with one key apart, the kebab-case
form makes every value a valid id, and translated labels keep their letters.
Names from source lines and names from all props were rejected, because an
edit above a use, or of any prop, would then change its id.

## Numbered Ids

Uses take their ids in render order. When an earlier instance of the same
[input scope](./mokly-component-usage-records.md#ownership-and-ordering)
holds the id of a use, the use takes the id, a hyphen, and the first number
from 2 that gives an id that the scope does not hold yet, such as `button-2`.
So the first use keeps the id without a number, and a named use whose id
equals an earlier number also takes a number.

Each numbered use gives one `instance-numbered`
[build warning](./mokly-build-warnings.md). Its subject is the rendered entry,
a variant included, as for the
[invocation warnings](./mokly-entry-props.md#schema-inference) of
`props-unsafe-integer`. So the subject kind is `component` when the rendered
entry is a component, and `entry` otherwise. Equal warnings merge under the
[record rules](./mokly-build-warnings.md#record), so the views of one entry
give one warning for each use. A numbered use inside a product component
gives its warning in each entry that renders that component. The message is
the first line below, or the second line when the use's record has a
`source`:

```text
component {component} instance {id} has a numbered id; give the use a key that is unique in its input scope
component {component} instance {id} at {path}:{line}:{column} has a numbered id; give the use a key that is unique in its input scope
```

`{component}` is the JSON-quoted resolved path of the stories entry, and
`{id}` is the JSON-quoted numbered id. `{path}` is the JSON-quoted path of the
record's `source`, and `{line}` and `{column}` are its numbers.
[Strict mode](./mokly-build-warnings.md#strict-mode) counts the warning.

Decision: a repeated id takes a number with a warning, so the build goes on.
A build error was rejected, because keys repeat across two lists of one
screen, and most screens that render a story component twice would fail. The
warning tells the author what to add, and `--strict` fails a repeated use
without a name.

## Related Docs

- [Component instance identity](./mokly-instances.md)
- [Storybook stories](./mokly-storybook.md)
- [Component change attribution](./mokly-component-changes.md)
- [Configuration](./mokly-configuration.md#instance-name-props)
- [Build warnings](./mokly-build-warnings.md)
