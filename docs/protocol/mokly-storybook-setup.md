# Storybook Story Setup

This page continues the [Storybook stories contract](./mokly-storybook.md). It
defines how the sidecar sets up each story render, and the globals that each
view gives a story.

## Setup Before Render

Before each story render, the sidecar runs the story's loaders and
`beforeEach` hooks, as Storybook's portable stories do. The render receives
the loaded data. Loaders and `beforeEach` hooks get the same args as
[the render](./mokly-storybook.md#the-entry-and-its-variants). A data arg that the render request
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

A `beforeEach` cleanup that throws fails its own render. When the render already
failed, it keeps its own error. No `beforeEach` cleanup runs in a later render.
So its error and the state that it undoes stay in its own render.

Decision: each story render runs its own `beforeEach` cleanups. A cleanup
before the next story loads, as in Storybook's own preview, was rejected, also
with one coordinator that orders `beforeEach` and `beforeAll` cleanups. When
such a late cleanup throws, it fails the render of the wrong story. Until it
runs, the state that it undoes stays in later screen and component renders.
Without the coordinator, such a cleanup can also undo a newer `beforeAll` setup.

Each sidecar keeps at most one active setup from the preview's `beforeAll` hook.
Before the sidecar composes a story, it makes the setup of the story's
generation active, so the composition, the view globals, and `load()` see the
setup. When the active setup belongs to another generation, the sidecar runs its
cleanup first. Then it runs the `beforeAll` hook of the story's generation, and
that setup becomes the active one. So a sidecar runs the hook once for each
generation, and again only after the setup of another generation replaced it.
The last setup gets no cleanup when the sidecar exits. A loader, a hook, a
cleanup, or a render that throws fails the render with
[`render-failed`](./mokly-sidecar.md#fail-closed-rules). When the `beforeAll`
hook throws, it does not run again for that generation, and each story render of
that generation fails with its error. Mokly runs no `play` function and no
`afterEach` hook.

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

- [Storybook stories](./mokly-storybook.md)
- [Render sidecar](./mokly-sidecar.md)
- [Build warnings](./mokly-build-warnings.md)
- [Sidecar definition transport](./mokly-sidecar-definitions.md)
