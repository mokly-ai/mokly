# Instance Ids

Status: A repeated id of a `defineComponent` wrapper or an HTML component element still fails the build, and a wrapper does not take its id from `key` yet. The [story component usage milestone](../../plans/storybook-support.md#milestone-35-story-component-usage) adds both.

This page continues the [instance contract](./mokly-instances.md). It defines
the local id of each instance, the numbers of repeated ids, and the
`instance-numbered` warning.

## Ids

The id of an instance comes from the first of its sources that gives a value:

| Instance                                                 | Sources, in order                                                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A component element in an HTML body                      | `mokly-instance`, then the segment                                                                                                 |
| A `defineComponent` wrapper                              | `moklyInstance`, then `key`, then the segment                                                                                      |
| A [story component use](./mokly-story-component-uses.md) | `key`, then each naming prop in the order of [`instanceNameProps`](./mokly-configuration.md#instance-name-props), then the segment |

The segment is the final segment of the component's resolved path, including
after index collapse or a declared path override. The component of a story
component use is its stories entry. A `mokly-instance` or `moklyInstance`
value is the id, and it uses the lowercase kebab-case grammar. A story
component use takes no `moklyInstance`: on such a use, it is an ordinary prop.

A `key` or a naming prop gives a value when it is a string or a finite number
whose kebab-case form below is not empty. A number counts as the text that
JavaScript's `String` gives it. The id is then the segment, a hyphen, and the
kebab-case form. For example, `key="Save"` on a use of `ui/button` gives
`button-save`. Without a value, the id is the segment alone, such as `button`.
The segment keeps its case, and these ids follow the
[segment grammar](./mokly-paths.md#segment-grammar).

The kebab-case form of a value comes from four steps:

1. Letters lose their accents: the text takes its canonical decomposition,
   and the combining marks drop out.
2. Letters become lowercase.
3. Each run of characters other than `a` to `z` and `0` to `9` becomes one
   hyphen.
4. The ends lose their hyphens.

So `Café` gives `cafe`, and `Save draft` gives `save-draft`.

Decision: a story component use takes its id from `key` and the naming props,
because authors already keep their values stable for lists, tests, and
accessibility. `moklyInstance` on a story component use was rejected, because
on a product component it fails TypeScript and can reach the product's markup.
A wrapper also takes its id from `key`, because a list of wrappers already has
keys, so each wrapper gets a stable id without a warning. Naming props for
wrappers were rejected, because an edit of a wrapper's data props must keep
its id.

Decision: the segment keeps the uses of two components with one key apart,
the kebab-case form makes every value a valid id, and translated labels keep
their letters. Names from source lines and names from all props were
rejected, because an edit above a use, or of any prop, would then change its
id.

## Numbered Ids

Instances take their ids in the encounter order of their
[input scope](./mokly-component-usage-records.md#ownership-and-ordering), and
instances of every kind share the ids of a scope. When an earlier instance of
the scope holds the id of an instance, the instance takes the id, a hyphen,
and the first number from 2 that gives an id that the scope does not hold
yet, such as `button-2`. So the first instance keeps the id without a number,
and a named instance whose id equals an earlier number also takes a number.
Slot content that a component renders more than once places one instance more
than once, and these placements repeat no id.

Each numbered instance gives one `instance-numbered`
[build warning](./mokly-build-warnings.md). Its subject is the rendered entry,
a variant included, as for the
[invocation warnings](./mokly-entry-props.md#schema-inference) of
`props-unsafe-integer`. So the subject kind is `component` when the rendered
entry is a component, and `entry` otherwise. Equal warnings merge under the
[record rules](./mokly-build-warnings.md#record), so the views of one entry
give one warning for each instance. A numbered instance inside the render of a
component gives its warning in each entry that renders that component.

The message is the first line below, or the second line when the record of
the instance has a `source`:

```text
component {component} instance {id} has a numbered id; give the use a {name} that is unique in its input scope
component {component} instance {id} at {path}:{line}:{column} has a numbered id; give the use a {name} that is unique in its input scope
```

`{component}` is the JSON-quoted resolved path of the instance's component,
and `{id}` is the JSON-quoted numbered id. `{path}` is the JSON-quoted path of
the record's `source`, and `{line}` and `{column}` are its numbers. `{name}`
is `key` for a story component use, `moklyInstance` for a wrapper, and
`mokly-instance` for an HTML component element.
[Strict mode](./mokly-build-warnings.md#strict-mode) counts the warning.

Decision: a repeated id takes a number with a warning, for every kind of
instance, so the build goes on and one rule covers every instance. A build
error was rejected, because keys repeat across two lists of one screen, and
most screens that render a component twice would then fail. A number can
change when an earlier instance changes, so the warning asks for a name, and
`--strict` fails a repeated id without one.

## Related Docs

- [Component instance identity](./mokly-instances.md)
- [Story component uses](./mokly-story-component-uses.md)
- [Component usage records](./mokly-component-usage-records.md)
- [Configuration](./mokly-configuration.md#instance-name-props)
- [Build warnings](./mokly-build-warnings.md)
