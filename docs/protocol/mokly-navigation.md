# Mokly Catalogue Navigation Contract

## Scope

This document defines how links authored in mockup documents behave when a
composed document is opened on its own, in served Browse, and in the static
build, and how the Browse shell keeps its route identity and catalogue tree
aligned after every navigation. The shell routes, the catalogue index and the
entry details that the shell navigates with are the
[shell delivery contract](./mokly-shell-delivery.md).

Mokly owns navigation between catalogue entries. Consumers own their product's
application routes and the behaviour of ordinary document, asset, external,
download, and same-document links.

Folder rows, folder pages, and breadcrumbs follow the
[folder contract](./mokly-folders.md#rows-and-clicks), and every row uses its
[search rule](./mokly-folders.md#titles). Changes activation uses the built
tree under the [branch-point lookup](./mokly-branch-point-lookup.md#consumers).

## Component Navigation

Registered component and component variant paths share the one catalogue
namespace. A component parent has its own view, rendered from its own props,
under the [entry props contract](./mokly-entry-props.md). A link to a
component parent resolves to that view in the effective viewport and colour
scheme, and a link to a variant resolves to that variant's own view; Browse
opens the parent's page or the variant's page, and the variant bar marks the
shown entry. The [explorer contract](./mokly-component-explorer.md) owns usage
queries and selecting an actual consumer instance; variant rows follow the
[variant contract](./mokly-variants.md). View and theme swaps replace iframe
history; outer Back/Forward continues between catalogue entries. Only
authenticated immediate frames receive inspection and link enhancement.
Temporary control documents keep the same script-disabled boundary and do not
grant nested frames shell access.

## Logical Catalogue Links

A logical link names a catalogue destination and an optional fragment. Its
authoring forms are:

- In JavaScript, `mockLink(to, fragment?)` and
  `<MockLink to={to} fragment={fragment}>`. The opt-in `MockLink asChild`
  extension and its static-control adaptation are the
  [styled link control contract](./mokly-link-controls.md).
- In HTML screens, pages and components, `href="mock:<path>[#fragment]"` on an
  anchor, and `to="<path>"` with an optional `fragment` on a component element
  or a raw `a`, `button`, `div`, or `span`, under the
  [HTML screens contract](./mokly-html-screens.md#links-and-markers).

The destination and the fragment are separate authoring concepts: `to` and
the first function argument hold only the destination, a complete path, a
relative path, or a definition reference under the
[authoring contract](./mokly-authoring.md), while `fragment` is a bare HTML
id without `#` or percent-encoding. The helpers reject overloaded or encoded
target syntax such as `path#fragment`, `path%23fragment`, or `mock:path` in
`to` or the first argument; an unknown but well-formed path fails while the
document is composed, naming the new path when the target moved. The helpers
emit a complete `mock:<path>[#fragment]` value, and authors may use that raw
form in supported navigation attributes.

A logical `href` is valid only on an HTML `<a>`/`<area>` or SVG `<a>` and makes
that native link eligible for Browse activation. A logical `href` on every
other element, including HTML resource elements and SVG `use`/`image`, fails
the render instead of becoming an accidental resource request. Authors use
`data-nav-href` for metadata-only references; it is valid on any element but
does not invent click or keyboard semantics. A logical `data-nav-href` may
coexist with an eligible logical `href`, in which case both must name the same
destination. A document with an activatable logical `href` must not contain
`<base href>`, because the base URL would change the browser's effective
portable destination without changing the attribute bytes that Browse
authenticates; a metadata-only `data-nav-href` does not activate that
restriction, and `<base target>` is supported under the
[target rules](#link-targets).
The entry's path is its Browse location, `/view/<path>/`. A folder is not a
destination; its own page, when it has one, shares its path. A use-case
destination opens the use-case page, even though its portable fragment
fallback resolves through the first screen in that use case.

### Fragments

A logical fragment contains one or more Unicode letters, numbers or combining
marks, `_`, `:`, `.`, or `-`. It names an HTML `id`, not a CSS selector. The
core validates that it exists in every composed view that Browse may show for
the destination: the mobile, desktop, light and applicable dark views of a
screen, or every document of a destination page or document. For a use case,
this requirement applies to its first screen. This cross-view rule lets one
canonical outer route drive every visible frame without silently losing the
anchor in another viewport or colour scheme.

### Link Targets

The core and the parent client classify a target value the same way. Neither
trims the value, and each value has exactly one typed state:

- absent, empty, or an ASCII-case-insensitive `_self` is `self`;
- ASCII-case-insensitive `_top`, `_parent`, and `_blank` are their
  corresponding reserved states;
- `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/` is a named target, preserving its case; and
- every other value, including whitespace or control characters, is invalid.

The [composition contract](./mokly-logical-links.md) defines what the core
writes for a logical link.

## Portable And Comparison Output

Composed documents are served and written under
`static/mokly-generated/<route>` and keep relative `href` values to other
documents and to authored closure files. They stay navigable when a document
of the static output is opened directly or copied with its closure, without
the Browse shell. Comparison generations hold the same documents under their
`snapshots/` trees and do not promote links into Browse routes; the pane guard
cancels activation and
[reveals same-document anchors](./mokly-comparison-scrolling.md#anchors).

## Browse Presentation

The core writes the marker and the derived target metadata while it composes
a document; Serve and `build` deliver those bytes unchanged, and no adapter
rewrites a document on delivery. The trusted document set is exactly every
current screen view of the index, including dark views, plus every current
page and document. When a marked native link from a trusted document is
presented beneath `/static/mokly-generated/`, the shell authenticates its
marker for parent enhancement while keeping the portable `href` and the live
`target`. It authenticates a marker only in an immediate, same-origin frame
whose document the frame adapter mounted for a trusted route under its
assigned-resource authentication; the plain marker does not authenticate its
document, and a document the frame reached by its own navigation gets no
enhancement. The parent resolves the marker's path through the index to the
canonical `/view/<path>/` or `/view/<path>/?fragment=<encoded-fragment>`
destination; it never trusts the portable URL as entry identity. It
recomputes the expected portable `href` of the marker's destination for the
frame's view and declines a marked link whose `href` differs, and it reparses
the derived target metadata under the
[target grammar](#link-targets) and declines an
invalid or context-inappropriate state. A `download` link is not promoted, and
`data-nav-href` without an eligible logical `href` stays portable metadata. A
composed document that carries an authored reserved attribute, a duplicate
reserved attribute, a malformed marker, or `<base href>` beside an
activatable marker fails its render, so Serve never serves it and `build`
fails. Neither delivery promotes an unmarked relative link or rewrites a live
`href`, `target`, `formtarget`, or `<base target>`.

Default same-origin Browse grants a frame access only so trusted parent code
can inspect its immediate document. It never grants `allow-top-navigation`,
`allow-top-navigation-by-user-activation`, `allow-popups`, `allow-forms`,
`allow-scripts`, or `allow-downloads`. The top-navigation restriction stays
active for the composed document and is inherited by every descendant
browsing context it creates, including `srcdoc`, local, and cross-origin child
frames. Consumer-authored `_top`, `_parent`, named, `<base target>`, and
`formtarget` values therefore cannot replace the shell even when they live in
nested content the parent cannot inspect. Trusted parent code is the only
outer-navigation authority. Portable and comparison documents keep their
original bytes; viewer-owned, script-disabled comparison panes cancel
navigation.

`/view/<path>/?fragment=<encoded-fragment>` carries the optional `fragment`
query in every delivery. Serve returns the same stub for every shell route and
renders no query-dependent HTML, so the shell reads at most one `fragment`
value from the URL, decodes it once, validates the
[fragment grammar](#fragments), and renders
the encoded hash into the source of every current screen frame and its light
and dark documents; on a use-case page it applies it only to the first step,
matching the portable fallback. An invalid or repeated value is not injected.
Authored links already carry the core's cross-view anchor proof, and updating
every swap source preserves the anchor through light and dark changes; a
direct URL whose syntactically valid fragment names no anchor stays at the
top of that frame. Without parent enhancement, links keep their portable
in-frame behaviour; no delivery promises outer page navigation or
logical-fragment transport from a click. A top-level `#fragment` is never
logical-fragment transport because URL hashes are not sent in an HTTP request.

## Enhanced Navigation And Safe Degradation

With the shell mounted, an unmodified primary or keyboard activation of a
default/`_self` marked link asks the outer shell to navigate through its
latest-wins route transition. The shell resolves the destination in the index
and renders it; it does not fetch a shell document. The resulting history
entry has the canonical `/view/<path>/[?fragment=...]` URL; the title,
breadcrumbs, heading, details inspector, frames, focus, and status
announcement all describe the destination. Back and Forward return through
those outer route entries and restore their route-owned scroll. Once React
owns a same-origin frame session, that ownership is continuous: a valid marked
activation during a viewport, scheme, variant, fragment, or route handoff
navigates the parent exactly once. The
[same-origin document rules](./mokly-frame-adapter.md#same-origin-documents)
decide which document keeps host-owned navigation during a handoff. Readiness
gates inspection, not logical navigation. Disposing or unsubscribing the
session removes the receiver; before the shell mounts, or without a receiver,
the portable link stays frame-owned as described below.

Outer same-document links, including the shell's skip link, keep native
fragment focus and scrolling. Document identity includes origin, pathname and
query but excludes the hash. A history event within the displayed document
must not change the rendered route, reinstall its workspace, or move focus
away from the native target. It invalidates any pending route transition so an
obsolete result cannot replace the retained view. Saved scroll positions may
be restored without a reload. A changed route or query still uses in-shell
navigation and its normal history restoration.

In every delivery the shell resolves that trusted path through the index to
the exact `/view/<path>/` URL before rendering or opening any context; there
is no alias page or redirect. See
[static delivery](./mokly-export-delivery.md). For a frame path that names no
current or removed entry, standalone and uncontrolled shells show the shared
missing destination and any later selection reinstalls its canonical URL. A
controlled viewer emits one frame error, changes no selection or display, and
emits no selection or navigation event. The
[artifact path contract](./mokly-artifact-paths.md) owns `viewHref`.

The same trusted parent enhancement exclusively handles modified pointer
activation and explicit non-self targets after validating the marker and
canonical destination. Modified activation includes Meta-, Ctrl-, or
Shift-modified click and middle-button `auxclick` (`button === 1`). A requested
`_top` or `_parent` uses the normal outer route transition. When a new or named
browsing context is requested, package-owned parent code opens the canonical
Mokly URL with `noopener`; it never delegates popup creation to the consumer
frame. Before the shell mounts, or when the bundle fails, the portable live
link stays frame-owned and subject to the sandbox; Mokly does not grant native
outer-navigation fallback.

Consumer scripts are disabled in default Browse. It permits same-origin
inspection but does not grant script, form, popup, download, or either
top-navigation capability to consumer documents. Comparison panes are
viewer-owned, script-disabled documents under the
[pane contract](./mokly-comparison-panes.md). External, raw relative,
download, same-document hash, metadata-only, and unmarked links keep their
frame-owned behaviour subject to the sandbox. Consumer-authored targets stay
byte-preserved, but the sandbox denies their access to the outer shell and to
popups. Mokly must not infer product navigation from URLs, `data-nav-href`, or
visible labels. The [frame link contract](./mokly-frame-link-navigation.md)
defines shared
fragment scope, local and cross-origin transports, and host revalidation.

## Related Docs

- [Shell delivery and read model routes](./mokly-shell-delivery.md)
- [Logical link composition](./mokly-logical-links.md)
- [Active catalogue visibility](./mokly-viewer-selection.md#active-catalogue-visibility)
- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [Package and authoring contract](./mokly-package.md)
- [Paths, roots, and identity](./mokly-paths.md)
- [Folders](./mokly-folders.md)
- [Shell destination queries](./mokly-shell-destinations.md)
- [Final logical link validation](./mokly-link-validation.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [Shell design contract](./mokly-shell-design.md)
- [Data flow](../architecture/rust-core.md#data-flow)
