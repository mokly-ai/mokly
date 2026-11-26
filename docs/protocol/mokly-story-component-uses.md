# Story Component Uses

Status: A use still leaves out each prop value that is not data, and the rule for its React content is not settled yet. The [story component usage milestone](../../plans/storybook-support.md#milestone-35-story-component-usage) adds the [recorded forms](#recorded-props) of those values.

This page continues the [instance contract](./mokly-instances.md). It defines
the uses of story components and the props that each use records. The
[instance id rules](./mokly-instance-ids.md) give the id of each use.

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

## Recorded Props

A use records every prop value without a failure. Its record holds only data
in the [wire form](./mokly-component-props.md#canonical-wire-props), so the
core can read it and check its props digest. Each value records in the first
of these forms that fits it, except React content: the `children` prop, a
prop whose value is an element, and an element inside a value.

- A string, a boolean, a finite number, and `null` record unchanged.
- A function prop stays out of the record. A function inside an object or an
  array records as one fixed text.
- `undefined` records as a missing key in an object and as `null` in an
  array. So an `undefined` prop records as an absent prop.
- `NaN`, `Infinity`, `-Infinity`, and a bigint record as a tagged text: a
  text that marks the value as not data and names it.
- A `Date` with a valid time records as its ISO text.
- An array, and an object with the shape that the
  [plain data rule](./mokly-component-props.md#plain-data) allows, record each
  member in these forms, unless they contain themselves.
- Every other value records as a text that holds the digest of its canonical
  form, such as a `Map`, a `Set`, another class instance, and a value that
  contains itself. The canonical form holds the constructor name and the own
  enumerable fields in these forms, and the entries of a `Map` or a `Set` in
  their order.

A prop value whose record would pass the nesting or node bounds of the plain
data rule also records as a digest text, so the record of a use stays inside
them. A value that changes on each render, such as `new Date()`, gives a new
record on each render. The entry that renders the use then shows a change in
each comparison.

Decision: every value records without a failure, because a product use cannot
change its props for Mokly. A failure was rejected, because a screen that
renders in the product would then fail. A warning for each such value was
rejected, because `--strict` would then fail on ordinary props, such as
`items` with an `onClick`. Leaving such values out was rejected, because their
edits would then drop out of Changes.

## Related Docs

- [Component instance identity](./mokly-instances.md)
- [Instance ids](./mokly-instance-ids.md)
- [Storybook stories](./mokly-storybook.md)
- [Component change attribution](./mokly-component-changes.md)
- [Component prop schema](./mokly-component-props.md)
