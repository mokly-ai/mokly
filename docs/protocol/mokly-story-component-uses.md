# Story Component Uses

This page continues the [instance contract](./mokly-instances.md). It defines
the uses of story components, how they render, and the props and the slots
that each use records. The [instance id rules](./mokly-instance-ids.md) give
the id of each use.

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

An element of these three kinds still becomes a use when another use receives
it as [content](#content) and Mokly [compiles](#rendering) its story component.
An element that records no use gets no instance region. So its output stays in
the comparison of the screen or the component that renders it.

## Explicit Refs

A use of a `forwardRef` component with an explicit `ref`, also inside `memo`,
records its instance and its slots as any other use does. The component
receives the `ref` unchanged. For a component that Mokly compiles, such a use
records nothing in two cases:

- Another use has the same `ref` value and equal props.
- Other code changes its props before it renders, such as with `cloneElement`.

An element of a class component with an explicit `ref` records no use.

Decision: a use that Mokly cannot match to one invocation records nothing,
because a wrong instance is worse than a missing one. A missing instance keeps
its output in the comparison that contains it.

## Rendering

A component that Mokly compiles keeps its own type, its static fields, and its
identity in every module, also as a use and as content. So a check such as
`child.type === Tab` holds as without Mokly. The component of a use receives
the caller's props. Each element in them keeps its type, its key, and its
props, except in the two cases below. No prop of Mokly's reaches the rendered
HTML.

Mokly compiles a component when a
[repository-owned module](./mokly-authoring.md#module-attribution-and-discovery)
defines it at its top level, under a name or as its default export, on both
compile paths. Workspace package sources count as repository-owned modules. A
component in another form, such as one in a destructured binding, counts as
one that Mokly does not compile. Mokly runs installed packages as they ship,
also when it bundles them.

Two kinds of element render through a Mokly element in their place:

- A supplied HTML element, and a supplied element of a component that Mokly
  does not compile, such as one from an installed package.
- Each use of a story component that Mokly does not compile.

The Mokly element has the same key and props, and a read of a static field on
its type reaches the original type. A component that checks the type of such
an element sees the Mokly element. Decision: a story component that Mokly does
not compile needs the Mokly element, because only a compiled component can
place the markers of its own output.

Decision: Mokly keeps the type of each component that it compiles. So a
parent that keeps only its `Tab` children, or clones them, renders as in the
product. A Mokly element around every use and every supplied element was
rejected, because such a parent then sees the Mokly element. One Mokly element
around the whole content was rejected, because it breaks components that read
their children, such as Radix `asChild` and `Children.toArray`. A render
through React's reconciler was rejected, because Mokly ships no private React
runtime under the [rendering boundary](./mokly-rendering.md#rendering-boundary).

## Content

The content of a use is each element in the value of one of its props, in
`children` or in another prop. The element is the whole value, or it is
inside an array, a plain object, a `Map`, or a `Set`. Each such element is an
implicit slot of the use.

The slot name is the prop name, a hyphen, and the element's `key`. An element
without a `key` uses its position in place of the key. The position is its
indexes and field names inside the value, joined with hyphens, or `0` for the
whole value. So `<Tabs><Tab key="a" /></Tabs>` gives the slot `children-a`,
and `item={{ icon: <Icon /> }}` gives `item-icon`. When two elements of one
use give one name, the later one takes the first free number from 2, such as
`children-a-2`.

A slot keeps its element in the caller's comparison, under the
[attribution rules](./mokly-component-changes.md#normalization-and-input-ownership).
A component that passes its content on to another use forwards the slot,
under the
[usage record rules](./mokly-component-usage-records.md#ownership-and-ordering).
The rest of each prop value, such as the text of the content, stays in the
use's [recorded props](#recorded-props) in its order.

Implicit slots belong only to the uses of a stories entry. Usage validation
still rejects an undeclared slot on an instance of every other component,
under the [usage record rules](./mokly-component-usage-records.md#validation).

Decision: each supplied element is its own slot. So every edit of the content
stays in the caller's comparison, and the component's own edits stay on its
page. Two other rules were rejected: usage lists alone, and no instance region
for a use with content. With either, an edit of the component's own render
shows as a change of each screen that uses it. Text stays in the props,
because a slot around text changes what the component receives, such as for a
`typeof children === "string"` check.

## Content Without Slots

A stories entry can set the field
[`contentSlots`](./mokly-storybook-setup.md#globals-for-views) of its `mokly`
parameter to `false`. Each use that is an instance of the entry then gets no
implicit slots and no Mokly elements around its content. So its content
renders exactly as in the product. Each use keeps its instance region and its
usage record, so the component's page still lists the screens that use it. In
the caller's comparison, that region is transparent under the
[attribution rules](./mokly-component-changes.md#normalization-and-input-ownership).

Decision: the switch serves a component that a Mokly element in its content
breaks, such as one that keeps only its `a` children. A switch that stops the
record of each use was rejected, because the component's page then loses its
usage list.

## Recorded Props

A use records every prop value without a failure. Its record holds only data
in the [wire form](./mokly-component-props.md#canonical-wire-props), so the
core can read it and check its props digest. Each value records in the first
of these forms that fits it. An element that is an implicit slot of the use is
the exception. Its slot holds it, and in an object, an array, or the props, it
records as `undefined` does. So the text next to it keeps its place.

- A string, a boolean, a finite number, and `null` record unchanged.
- A function prop stays out of the record. A function inside an object or an
  array records as one fixed text.
- Every other element, such as one inside a class instance, follows the rule
  of a function.
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
- [Storybook story setup](./mokly-storybook-setup.md)
- [Component change attribution](./mokly-component-changes.md)
- [Component prop schema](./mokly-component-props.md)
