# Shared Control Rendering

The static rendering and module resolution sub-contract of
[Shared controls](./shared-controls.md): what a generated document contains,
how registered controls behave without hydration, how a catalogue link wraps a
control, and the one web resolution boundary the catalogue, its typechecks and
its tests share.

## Static Rendering And Navigation

A generated document emits Firna's public DOM backend stylesheet in `head`
before the token and consumer styles; the package's root import is reserved for
that stylesheet boundary, and controls use their public subpaths. The document's
block content renders inside the package's theme boundary, which is a real
boxless element carrying the focus variables; the boundary never wraps `html`
and never sits directly inside a table row, a list, a paragraph or an SVG. The
theme is the complete theme of the requested scheme, and dark output always
extends the library's dark preset. Each document takes the theme of the palette
that the [renderer](./mockups.md#screen-and-renderer-boundary) chooses. Header,
PageFrame and Card stay registered as Design-only layouts.

Mokly collects the react-native-web atomic styles of each render, so every
class that the content uses is present. It puts them in `head` before the
configured stylesheet links. The document is never hydrated and
carries no event scripts and no native runtime code. Two independent
compilations of the catalogue are byte-identical; see
[Build determinism](./mockup-verification.md#build-determinism).

An enabled static Button is rendered enabled, and a value-bearing Input keeps
its value, without any handler serialized into the HTML. Inputs keep their real
labels, help and error associations, editable or disabled state, and values. A
disabled field exposes disabled state, not only read-only state, and is not in
the tab order. An enabled field is editable in a static browser without
submitting.

A static document theme uses `focusIndicator: "outline"`, because Firna's CSS
focus backend works without hydration and the browser outline is the one the
rest of the document uses; live product UI keeps the package's default
`focusIndicator: "ring"` glow. `"none"` is used only where the surrounding
surface supplies a visible focus indicator. For a composite field, keyboard
focus stays on the input while the visible outline is painted on its enclosing
field frame. Shared local link focus styling and Mokly's adapted-link outline
stay active; the controls' outline is never overridden with CSS.

A catalogue link around a registered control adapts the wrapper's single
rendered Firna root to a native anchor; the supported roots are `a`, `button`,
`div` and `span`, and the adapted control keeps its classes, styles and label.
No outer wrapper is added around a Button and no interactive node is put in
its decorative trailing slot. Disabled controls stay inert. Both file
navigation and the served Browse shell work.

The pinned `@mokly/mokly` release checks link placement in tiers — the
ancestors, the root, then the descendants — and the closest error beats a
warning; the tiers and the roles they cover are in the installed package's
`docs/protocol/mokly-link-controls.md`. This repository's own builds,
validation builds, fixture builds and publishes run with `--strict`, so a
placement warning fails the command. A cloud build runs the
customer's publish with the exact arguments in
[Cloud build runner](./cloud-build-runner.md#steps), which add no `--strict`.
Move a link out of a warning or error ancestor and remove interactive
descendants; never suppress the warning or restyle a Firna control.

## Module Resolution

The catalogue, its typechecks and its test loaders resolve modules through one
public web boundary: React Native resolves to the single react-native-web
runtime, the `react-native` export condition is preferred, `.web.*` modules
win over their generic siblings, and `ts` is the one package root, including
for React Native imports inside dependencies. The Mokly configuration holds
the mapping; see
[Mockup tooling](./mockup-tooling.md#configuration-and-scripts). The viewer
drawings take `@mokly/ui/styles.css` through a side-effect import, which Mokly
bundles into the entry's stylesheet. The faces that the drawings use and the
generated asset paths are in
[Mockup tooling](./mockup-tooling.md#imported-viewer-styles).

Typechecks resolve the installed packages' public declarations; runtime tests
resolve their public JavaScript entry points and the react-native-web runtime.
The tests run the published web components and stub no native behaviour.
Types are never satisfied with runtime stubs, and a second copy of React is
never imported.
