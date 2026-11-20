# Storybook Stories

Status: Milestones of the Storybook support plan add the parts of this page that are not implemented yet. [Milestone 4](../../plans/storybook-support.md#milestone-4-story-args-names-tags-and-descriptions) adds the arg rules for inferred argTypes and React elements, Storybook story names, tags, the description, and the tag filter. [Milestone 5](../../plans/storybook-support.md#milestone-5-story-setup-before-render) adds loaders, `beforeEach`, and `beforeAll` before a render. [Milestone 6](../../plans/storybook-support.md#milestone-6-the-first-story-as-the-parent-page) adds the first story as the parent page. [Milestone 7](../../plans/storybook-support.md#milestone-7-globals-from-the-mokly-parameter) adds the `mokly` parameter.

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
path plus its export name as the slug. Its data args are its props, and its
views render that story. The entry is a component entry, so the read model
needs no new kind. Decision: the first story is the parent page, as on
Storybook's docs page. The meta then needs no complete args, and no page
repeats the state of the first story. A meta page with a fallback and a
summary page were rejected.

The story id is the file path, `#`, and the export name. `describe` lists
every included story of the generation. Mokly infers the schema from the
props of every included story under the
[entry props contract](./mokly-entry-props.md#schema-inference). A
`renderStory` request carries the merged data props. The sidecar applies them
over the composed story's own args, so non-data args stay as the file defines
them.

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

## Setup Before Render

Before each story render, the sidecar runs the story's loaders and
`beforeEach` hooks, as Storybook's portable stories do. The render receives
the loaded data. A `beforeEach` cleanup runs before the next story loads, as
in Storybook. Each sidecar keeps at most one active setup from the preview's
`beforeAll` hook. Before a story of a bundle generation loads, the sidecar
checks the active setup. When the active setup belongs to another generation,
the sidecar runs its cleanup first. Then it runs the `beforeAll` hook of the
story's generation, and that setup becomes the active one. So a sidecar runs
the hook once for each generation, and again only after the setup of another
generation replaced it. The last setup gets no cleanup when the sidecar
exits. A loader, a hook, a cleanup, or a render that throws fails the render
with [`render-failed`](./mokly-sidecar.md#fail-closed-rules). When the
`beforeAll` hook throws, it does not run again for that generation, and each
story render of that generation fails with its error. Mokly runs no `play`
function and no `afterEach` hook.

Decision: Mokly also runs the preview's `beforeAll` hook, as Storybook's test
runners do. Running only the loaders and the `beforeEach` hooks was rejected.
Decision: one setup at a time is active in a sidecar, as in Storybook's own
preview after a reload, because a setup changes globals that the whole process
shares. A cleanup when the sidecar releases a generation was rejected, because
two loaded generations would then keep two setups.

## Globals For Views

Each story render gets the view's viewport, `mobile` or `desktop`, as the
global `moklyViewport`. It gets the view's colour scheme, `light` or `dark`,
as the global `moklyColorScheme`.

A story can have a `mokly` parameter with the fields `colorSchemes` and
`viewports`. `colorSchemes` maps a colour scheme name, `light` or `dark`, to
an object of Storybook globals. `viewports` maps a viewport name, `mobile` or
`desktop`, to an object of Storybook globals. Mokly reads the parameter from
the composed parameters of each story, so the preview, the meta, and the
story can each set or override it. For each view, Mokly applies these globals
over the composed story's globals, the story's own `globals` included. It
applies them in this order, so that a later item wins:

1. The mapped globals of the view's viewport.
2. The mapped globals of the view's colour scheme.
3. `moklyViewport` and `moklyColorScheme`.

Decision: a `mokly` parameter maps the views to Storybook globals, because
Storybook merges parameters for each story, as Chromatic's modes do.
Documentation alone, detection of `addon-themes`, and a map in
`mokly.config.json` were rejected. One view combines one viewport and one
colour scheme, so both maps apply to it. The mapped globals win over the
story's own `globals`, as the globals of a Chromatic mode do.

## Related Docs

- [Render sidecar](./mokly-sidecar.md)
- [Entry props and variants](./mokly-entry-props.md)
- [Variants](./mokly-variants.md)
- [Component controls](./mokly-component-controls.md)
- [Build warnings](./mokly-build-warnings.md)
- [Sidecar definition transport](./mokly-sidecar-definitions.md)
