# Storybook Stories

## Stories Files

A stories file is a `*.stories.{ts,tsx,js,jsx}` file that a root matches. The
[render sidecar](./mokly-sidecar.md) reads each story through Storybook's own
story composition from `@storybook/react`, and it renders the story to static
markup. The sidecar applies the consumer's `.storybook/preview` annotations
once to each story. Mokly reads the composed args, argTypes, parameters, and
tags of each story. A consumer without `@storybook/react` fails `bundle` with
`bundle-failed` that names the missing package.

Mokly reads these forms of stories files:

- CSF 2: a default-export meta and function stories with static `args` and
  `storyName` fields.
- CSF 3: a default-export meta and story objects.
- CSF Factories: stories from `meta.story()` on a meta from `preview.meta()`,
  without a default export. Mokly takes the meta and the preview of such a
  file from its stories.

## Included Stories

The combined tags of a story start with Storybook's default tags, `dev` and
`test`, and Mokly's default tag, `mokly`. The tags of the preview, the meta,
and the story follow, in that order. A `!name` tag removes the tag `name`. A
story is included when its combined tags contain `dev` and `mokly`. So `!dev`
or `!mokly` in the preview, the meta, or the story leaves the story out,
unless a later tag adds the removed tag again. The meta's `includeStories`
and `excludeStories` filters also apply, as in Storybook. Decision: Mokly
applies Storybook's own tag rule. `!dev` hides a story from Storybook's
sidebar and from Mokly, and `!mokly` hides it from Mokly only.

A stories file without an included story gives no entry and no warning.
Decision: such a file gives no warning, because a warning would fail
`--strict`, and Storybook's sidebar shows no story without the `dev` tag
either.

## The Entry And Its Variants

A stories file with an included story gives one component entry at the path
derived from the file under the [path contract](./mokly-paths.md). A Storybook
title never changes a path. Decision: paths stay derived from the file. Paths
from Storybook titles and from Storybook's automatic titles were rejected, so
that no catalogue path changes.

The first included story in source order is the parent page. Its
[data args](#args-and-props) are the parent's props, and the parent's views
render that story. Each other included story is a variant at the parent's
path plus its export name as the slug. Its props are only its own data args,
and its views render that story. Mokly does not lay a variant's props over the
parent's props. The entry is a component entry, so the read model needs no new
kind. Decision: the first story is the parent page, as on
Storybook's docs page. The meta then needs no complete args, and no page
repeats the state of the first story. A meta page with a fallback and a
summary page were rejected.

The story id is the file path, `#`, and the export name. `describe` lists
every included story of the generation. Mokly infers the schema, with its
required keys, from the props of every included story under the
[entry props contract](./mokly-entry-props.md#schema-inference). Each included
story renders with its own non-data args and exactly the data props of its
render request. A data arg that the render request leaves out is not in the
story's args.

Decision: each story shows, edits, compares, and renders exactly its own args,
so that each story renders as in Storybook. A render that lays the requested
data props over the story's own args was rejected, because an optional prop
that a control unsets then keeps the story's value. Inheritance from a parent
with only the args that every story shares was rejected, and so was one schema
for each story, because some args then have no control.

The [story component use rules](./mokly-story-component-uses.md) define how a
screen, a component, or a story of another entry that renders the meta's
`component` records an instance of this entry.

## Args And Props

Mokly classifies the args of a story by the composed argTypes of that story.
These argTypes include the argTypes that Storybook infers from arg values. For
example, Storybook infers the type `function` for a function arg. An arg is
not a prop when its argType has `control: false`, `table.disable: true`, an
`action`, or a `type` of `function`. An arg whose value is a React element, or
an array of React elements, is not a prop either. Such an arg stays out of the
props, the schema, and the fragment key without a warning. The story renders
with the file's own value for it. Every other arg whose value is not data
stays out of the props with the `props-not-data` warning of the
[entry props contract](./mokly-entry-props.md#schema-inference). The args that
remain are the data args of the story.

Each story render applies the argTypes `mapping` and `if` of its composed
story, as Storybook's own preview does. A mapped arg reaches the decorators,
the loaders, the `beforeEach` hooks, and the render with its mapped value. An
arg whose `if` condition does not hold is not in their args.

Decision: Mokly follows the composed argTypes and leaves React element args
out without a warning, so Storybook's own example stories pass `--strict`.
Leaving out function args only was rejected, and so were slots for React
element args. A React element arg gets no warning, because Storybook also
renders such an arg and cannot edit it.

## Controls

Story argTypes give control hints. They never change the prop schema. The
parent and each variant take their hints from the composed argTypes of their
own story. A story gives hints for every prop of the entry, also for a prop
that the story does not set. An argType's `options` give the choices of the
derived select. Its `control.min`, `control.max`, and `control.step` give the
bounds and the step of the derived number control. Its `name` and
`description` give the label and the help text of the control. The bounds
apply to the complete merged props during live validation. A saved arg
outside the bounds gives a `props-control-bounds` warning under the
[component controls contract](./mokly-component-controls.md).

## Names, Tags, And The Description

The entry's title is the last segment of the meta `title`. Without a meta
`title`, the entry's title is the display name of the meta's component, else
the component's name, else the slug derived from the file name under the
[slug rule](./mokly-entry-modules.md#slugs). A variant's title is its story
name as Storybook gives it: the `name` of a story object, else the story's
`storyName`, else its export name in start case, such as `Large Button` for
`LargeButton`. Decision: the catalogue shows the names of Storybook's sidebar.

The entry's tags are the custom tags of the first included story. Each
variant's tags are the custom tags of its own story. A custom tag is a
combined tag that matches the kebab-case
[tag grammar](./mokly-authoring.md#entry-kinds), is not `mokly`, and is not one
of Storybook's built-in tags, such as `dev`, `test`, `autodocs`, and
`play-fn`. Mokly drops every other tag without a warning. Decision: Storybook
tags have no grammar, so a warning would fail `--strict` for normal stories
files.

A string `parameters.docs.description.component` of the first included story
is the entry's description. Mokly shows no story description, and each
variant keeps the entry's description. Decision: story descriptions stay
hidden, because the variants of a stories entry have no description of their
own.

## Story Setup

The [story setup rules](./mokly-storybook-setup.md) define how the sidecar
runs the loaders, the `beforeEach` and `beforeAll` hooks, and their cleanups.
They also define the globals that each view gives a story.

## Failed Stories

The [story failure rules](./mokly-storybook-failures.md) define what Mokly does
when a story cannot render. They define the failed view, its
`story-render-failed` warning, its error document, and the reason that both
give.

## Related Docs

- [Storybook story setup](./mokly-storybook-setup.md)
- [Storybook story failures](./mokly-storybook-failures.md)
- [Render sidecar](./mokly-sidecar.md)
- [Entry props and variants](./mokly-entry-props.md)
- [Variants](./mokly-variants.md)
- [Component controls](./mokly-component-controls.md)
- [Build warnings](./mokly-build-warnings.md)
- [Sidecar definition transport](./mokly-sidecar-definitions.md)
