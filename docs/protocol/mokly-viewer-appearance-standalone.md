# Standalone Appearance Control

Status: The Appearance control is not restyled in Canvas yet, and the canvas stage, the right panel and the Frames filter that a choice leaves alone are not built. [Milestone 11](../../plans/canvas-redesign-milestones-viewer.md#milestone-11-canvas-stage-in-moklyui) builds the restyled control and the canvas stage, and [Milestone 12](../../plans/canvas-redesign-milestones-viewer.md#milestone-12-right-panel-and-compare) builds the right panel and its Frames filter.

This continues the [viewer appearance contract](./mokly-viewer-appearance.md):
the one appearance control of Serve and the static build.

## Control

Serve and the static build expose one compact native selector labelled
**Appearance**, with **Auto**, **Light** and **Dark** options, in the global
top bar, restyled in Canvas. Decision: the standalone shell keeps this control
in its top bar, not in an account menu as the cloud does, because the
standalone shell has no account menu. It is the only appearance control in the
standalone shell: there is no top-bar or head-band `Light | Dark` preview
switch and no Dark mode button in the component workspace, and the Frames
filter's scheme toggles choose frames, not the appearance. The control is
present even when the catalogue has no dark views. It stays reachable on home,
pages, documents, flows, empty and unavailable routes, and at narrow widths,
and preserves catalogue search and menu access.

## Choosing A Value

Choosing a value applies the interface appearance and the effective preview
scheme together: the shell root's appearance mark and the reading frame of a
Markdown document. The frames on the canvas keep their own schemes. A view
outside the canvas stage swaps its screen and flow frames, component samples
and comparison frames to the light or dark documents, under the unchanged swap
rules, including the light-only fallback caption.

In-shell navigation, Back and Forward keep the current reader choice, even
when the destination URL contains an older or conflicting `scheme` pin. Before
any reader choice, a scheme-bearing in-shell destination applies its pin to
the whole appearance without saving it; an unpinned destination keeps the
current document appearance. Only the appearance interprets these pins, and a
route change never overwrites the preview colour scheme on its own. A
standalone appearance change swaps only document sources and keeps the
navigation, the Frames filter, the canvas's pan and zoom, the right panel,
scroll and search state.

## Load Order And Storage

On a full page load the effective appearance is resolved in this order: a
`scheme` URL parameter of `light` or `dark` pins the appearance for that
document without saving it; otherwise a valid stored override applies;
otherwise Auto. A user selection wins for the lifetime of the current
document, replacing a URL pin, even if storage is unavailable. A link without
`scheme` follows each reader's own appearance, so two readers can see
different views; a link with `scheme` shows the same views to everyone.

Standalone preferences use the origin-local key `mokly:theme`. Store only
explicit `light` or `dark`; selecting Auto removes the override. Invalid
stored values are ignored. Read, write and remove failures do not break
navigation or show a catalogue error. No credentials or cookies are involved.

## First Render

The shell bundle resolves the effective appearance before its first render,
as the [shell delivery contract](./mokly-shell-delivery.md) requires: the
shell root carries the appearance mark from its first render, and every frame
mounts with the document of its scheme, its own on the canvas and the
effective preview scheme outside it. No frame loads a light document and
swaps to dark at startup, and no pre-paint script exists. Under Auto the
appearance follows system changes while the document is open. Later choices
and system changes update the shell root and the preview selection together,
and only the frame adapters navigate preview documents. Appearance changes
never add iframe history entries or consume catalogue Back/Forward actions. A
second installation of the appearance behaviour duplicates no callback or
storage write. A page that the browser's back-forward cache restores refreshes
its appearance. In-shell navigation, detail updates and Serve publications
carry the current effective appearance forward rather than a separate preview
state.

Before the bundle runs, and without JavaScript, the stub shows only its
`<noscript>` sentence. The shell stylesheet gives the stub's `mbk-document` class
the Auto interface appearance through `prefers-color-scheme`. The selector
exists only once the bundle installs its behaviour, so no control without a
change handler is ever shown. Persisted overrides need the bundle.

## Related Docs

- [Viewer appearance](./mokly-viewer-appearance.md)
- [Shell delivery](./mokly-shell-delivery.md)
- [Shell device chrome and preview scheme](./mokly-shell-device-chrome.md)
