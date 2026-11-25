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

## Setup Before Render

Before each story render, the sidecar runs the story's loaders and
`beforeEach` hooks, as Storybook's portable stories do. The render receives
the loaded data. Loaders and `beforeEach` hooks get the same args as
[the render](#the-entry-and-its-variants). A data arg that the render request
leaves out is not in their args. A change that a loader or a hook makes to the
args reaches the decorators and the render, as in Storybook's own preview.

Decision: loaders, `beforeEach` hooks, and the render get the same args, so
that loaded data and hook state match the props of the render. Running loaders
and hooks with saved args was rejected, because an edited or unset prop then
keeps its saved value in what they prepare.

Each story render runs the cleanups that its own `beforeEach` hooks return. The
sidecar runs them in the reverse order of their hooks, after the markup of the
render is complete. It runs them also when a loader, a `beforeEach` hook, or
the render throws. So when one hook throws, the cleanups of the hooks before it
still run. Each cleanup runs once, also when it or another cleanup throws.

A `beforeEach` cleanup that throws fails its own render. When the render
already failed, it keeps its own error. No `beforeEach` cleanup runs in a later
render. So neither the state that such a cleanup undoes nor its error reaches a
later render of a story, a screen, or a component.

Decision: each story render runs its own `beforeEach` cleanups. A cleanup
before the next story loads, as in Storybook's own preview, was rejected, also
with one coordinator that orders `beforeEach` and `beforeAll` cleanups. When
such a late cleanup throws, it fails the render of the wrong story. Until it
runs, the state that it undoes stays in later screen and component renders.
Without the coordinator, such a cleanup can also undo a newer `beforeAll` setup.

Each sidecar keeps at most one active setup from the preview's
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
over the composed story's globals, the story's own `globals` included. Before
the loaders, the `beforeEach` hooks, and the render run, it applies them in
this order, so that a later item wins:

1. The mapped globals of the view's viewport.
2. The mapped globals of the view's colour scheme.
3. `moklyViewport` and `moklyColorScheme`.

Decision: a `mokly` parameter maps the views to Storybook globals, because
Storybook merges parameters for each story, as Chromatic's modes do.
Documentation alone, detection of `addon-themes`, and a map in
`mokly.config.json` were rejected. One view combines one viewport and one
colour scheme, so both maps apply to it. The mapped globals win over the
story's own `globals`, as the globals of a Chromatic mode do.

Mokly ignores each of these malformed values on its own and uses the valid rest:

| Malformed value                                                  | Path                                      | Reason                  |
| ---------------------------------------------------------------- | ----------------------------------------- | ----------------------- |
| A `mokly` parameter that is not a plain object, such as an array | `mokly`                                   | `not an object`         |
| A field other than `colorSchemes` and `viewports`                | such as `mokly.colourSchemes`             | `unknown field`         |
| A `colorSchemes` or `viewports` value that is not a plain object | `mokly.colorSchemes` or `mokly.viewports` | `not an object`         |
| A name other than `light` and `dark` in `colorSchemes`           | such as `mokly.colorSchemes.sepia`        | `unknown colour scheme` |
| A name other than `mobile` and `desktop` in `viewports`          | such as `mokly.viewports.tablet`          | `unknown viewport`      |
| A mapped value that is not a plain object                        | such as `mokly.colorSchemes.dark`         | `not an object`         |

A `mokly` parameter that is absent or `undefined` is not malformed. Mokly does
not check the globals inside a mapped object. Each malformed value gives one
`storybook-parameter-ignored` build warning on each story page whose composed
parameters hold it, so a value in the preview gives a warning on each story
page that does not override it. Its subject is the entry of that page: the
parent path for the first included story, and the variant path for each other
story. Its message is `parameter <JSON-quoted-path> is ignored: <reason>`,
such as `parameter "mokly.viewports.tablet" is ignored: unknown viewport`.

Decision: Mokly ignores a malformed value with a warning, because the views
still render, and the parameter belongs to Mokly. A silent ignore was
rejected, because a typo then shows only as a wrong theme or layout. A failed
render was rejected, because a typo then stops the build. A `MoklyParameter`
type alone was rejected, because Storybook's parameter type accepts any key,
so it helps only files that apply it. An `invalid-field` failure at describe
time was rejected, because one typo then fails the whole build.

## Related Docs

- [Render sidecar](./mokly-sidecar.md)
- [Entry props and variants](./mokly-entry-props.md)
- [Variants](./mokly-variants.md)
- [Component controls](./mokly-component-controls.md)
- [Build warnings](./mokly-build-warnings.md)
- [Sidecar definition transport](./mokly-sidecar-definitions.md)
