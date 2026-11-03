# Frame Package

Status: In progress under the [frame package plan](../../plans/frame-package.md).

This continues the [viewer frame adapter contract](./mokly-frame-adapter.md).

## Package And Entries

`@mokly/frame` is an MIT, ESM npm package under `packages/frame`. It holds the
frame adapter interface, the built-in adapters `sameOriginAdapter` and
`postMessageAdapter`, and both ends of the
[frame probe wire protocol](./mokly-frame-probe-wire.md): the host side and
the [frame probe](./mokly-frame-probe.md) script that runs inside published
pages.

The root entry exports the
[public interface](./mokly-frame-adapter.md#public-interface) of the frame
adapter contract: its types, `sameOriginAdapter`, and `postMessageAdapter`.
The one internal subpath, `@mokly/frame/internal`, exports the frame code that
only the viewer uses, and only `@mokly/viewer` imports it. Decision: one
internal subpath, not more exports of the root entry, so that the shell's
session data stays out of the public frame interface.

The package builds the frame probe script. The viewer package lists that
script in its browser module inventory, so Serve and the static build deliver
it from the viewer at the path that the frame probe contract names.

## Package Boundary

`@mokly/frame` depends on the exact released version of `@mokly/model`, the
[model package](./mokly-model-package.md). `@mokly/viewer` depends on the
exact released versions of both packages. The frame package never imports the
viewer, the CLI, or consumer code. Decision: a separate package, not a
directory of the viewer with a convention or an import lint, because a package
boundary stops each import of the viewer internals at the compiler, which a
lint only finds.

`@mokly/viewer` re-exports the public adapters and frame types from its root
entry. Hosts import them only from the viewer. Decision: hosts import the
frame interface from the viewer, not from this package, because the package
keeps the state of mounted frames per installed copy, and a second copy would
split that state.

## Built-In Adapters

Both built-in adapters run one event runtime, so the same rules decide their
hover, click, pick-end, navigation, and geometry events, including the hover
rule of the
[selection contract](./mokly-viewer-selection.md#selection-events-and-imperative-use).
Decision: one shared runtime, not two runtimes kept in step, because one
runtime removes the drift between the adapters.

Both built-in adapters measure boxes with one set of clipping rules.
Viewport-fixed elements and their text escape ordinary overflow ancestors;
clipping resumes at a fixed-position containing block (including transforms,
perspective, filters, containment or relevant `will-change`). Inner scrollers
still clip their own descendants. Ancestor visibility and opacity remain
effective across a fixed-position escape. This follows the
[CSS containing-block model](https://www.w3.org/TR/css-position-3/#def-cb).

## Release

The package releases in lockstep with `@mokly/mokly`, `@mokly/viewer`,
`@mokly/ui`, and `@mokly/model`, at their one shared version, under the
[release contract](./npm-release.md#package-set).
