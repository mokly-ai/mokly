# Mokly Catalogue Navigation Contract

Status: In progress under the [Rust rebuild plan](../../plans/rust-rebuild.md).

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

Folders follow the [folder contract](./mokly-folders.md#rows-and-clicks): a
folder row only expands or collapses and is never a destination; an entry row
navigates; a folder's own page is its first child row, labelled with its title
or `Overview`, or, for a screen or component index, the folder renders as that
entry's row; and a breadcrumb folder segment opens the folder page when one
exists and otherwise expands the folder. Empty folders have no row. Every row
uses the single [search rule](./mokly-folders.md#titles). Changes activation
uses the built tree under the
[branch-point lookup](./mokly-branch-point-lookup.md#consumers).

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

A logical link names a catalogue destination and an optional fragment:

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
restriction, and `<base target>` is supported under the target rules below.
The entry's path is its Browse location, `/view/<path>/`. A folder is not a
destination; its own page, when it has one, shares its path. A use-case
destination opens the use-case page, even though its portable fragment
fallback resolves through the first screen in that use case.

A logical fragment contains one or more Unicode letters, numbers or combining
marks, `_`, `:`, `.`, or `-`. It names an HTML `id`, not a CSS selector. The
core validates that it exists in every composed view that Browse may show for
the destination: the mobile, desktop, light and applicable dark views of a
screen, or every document of a destination page or document. For a use case,
this requirement applies to its first screen. This cross-view rule lets one
canonical outer route drive every visible frame without silently losing the
anchor in another viewport or colour scheme.

While it composes a document, the core must:

- validate the destination path and optional fragment before the document
  enters the render cache;
- rewrite the actual `href` and `data-nav-href` to the relative document URL
  of the destination for the source viewport and colour scheme, with light
  fallback;
- add one package-owned `data-mokly-link` marker holding the resolved complete
  `<path>[#fragment]` destination only to an activatable native link;
- remove any consumer-authored `data-mokly-target`, parse the eligible link's
  effective request from its own `target` or the document's applicable first
  `<base target>`, and keep a valid non-self request only in newly derived
  inert `data-mokly-target` metadata; and
- reject a logical `href` on any other element, a `<base href>` in a document
  with an activatable logical link, a reserved marker supplied by consumer
  output, duplicate occurrences of either reserved navigation attribute, or
  conflicting logical destinations carried by two navigation attributes on
  one element.

The [final link validation contract](./mokly-link-validation.md) defines
reference records, final anchor checks and Markdown safety. No consumer
transformation runs after rewriting. The marker is inert metadata, not a
second resource URL: HTML escaping is deterministic, link and resource
validation inspect the portable attributes, and markers never grant resource
access. Raw relative links do not become catalogue links merely because they
resolve to a composed document, so catalogue intent stays explicit and Mokly
never takes over product or asset navigation by accident.

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
the derived target metadata with the parser below and declines an invalid or
context-inappropriate state. A `download` link is not promoted, and
`data-nav-href` without an eligible logical `href` stays portable metadata. A
composed document that carries an authored reserved attribute, a duplicate
reserved attribute, a malformed marker, or `<base href>` beside an
activatable marker fails its render, so Serve never serves it and `build`
fails. Neither delivery promotes an unmarked relative link or rewrites a live
`href`, `target`, `formtarget`, or `<base target>`.

One pure target parser is shared by the core and the parent client. It does
not trim its input and returns exactly one typed state:

- absent, empty, or an ASCII-case-insensitive `_self` is `self`;
- ASCII-case-insensitive `_top`, `_parent`, and `_blank` are their
  corresponding reserved states;
- `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/` is a named target, preserving its case; and
- every other value, including whitespace or control characters, is invalid.

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
value from the URL, decodes it once, validates the grammar above, and renders
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
owns a same-origin frame session, that ownership is continuous while the
adapter replaces its document only when the still-visible document is the
exact `Document` that an earlier same-origin mount authenticated for that
frame. The shell transfers its navigation receiver to that authenticated
document before starting the replacement, so a valid marked activation during
a viewport, scheme, variant, fragment, or route handoff still navigates the
parent exactly once. A document the session did not authenticate stays
frame-owned until a different replacement document passes assigned-resource
authentication; a frame's starting document is never authenticated by URL
equality alone, except the document that the frame's initial `src` started
loading on its first mount. The receiver follows the new same-origin document
as soon as its exact resource identity can be authenticated; pending images,
fonts, or other subresources cannot reopen a native-navigation gap before
`load`. Readiness gates inspection, not logical navigation. Disposing or
unsubscribing the session removes the receiver; before the shell mounts, or
without a receiver, the portable link stays frame-owned as described below.

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
visible labels.

### Frame Adapter Boundary

The [frame link contract](./mokly-frame-link-navigation.md) defines shared
fragment scope, local and cross-origin transports, and host revalidation.

## Active Catalogue Visibility

Every successful outer route change, including in-shell navigation, Back,
and Forward, establishes one navigation invariant: when the route has a
catalogue row, that row is visible and marked `aria-current="page"`.

To establish the invariant, Browse must:

1. remove `aria-current` from every other row;
2. open each ancestor `[data-nav-disclosure]` of the active row, including
   its Specs or Components section and, for an entry with variants or one of
   its variants, the parent row's variant list defined by the
   [variant contract](./mokly-variants.md). That list is a container rather
   than a `<details>`, so opening it clears its `hidden` state and presses its
   disclosure button instead of setting `open`;
3. preserve unrelated folder disclosures;
4. clear a search query only when it would hide the destination;
5. switch Changes to All only when the destination is not changed;
6. reapply navigation visibility after those adjustments; and
7. scroll the active row into the nearest visible part of the catalogue pane.

The responsive drawer closes after navigation so it does not cover the new
screen. Its tree keeps the opened destination path for the next time it is
opened. A user may collapse the active path afterward; the next route change
re-establishes the invariant.

Each user edit to search or the All/Changes filter opens groups to reveal the
rows matching the updated constraints. Reapplying the same active constraints
during a route change or a Serve publication must instead preserve groups the
user subsequently collapsed; only the destination row's ancestor path may be
reopened. Clearing every filtering constraint restores the disclosure state
captured before filtering began, except that an ancestor opened for the
navigated destination stays open so the active row stays visible.

Enhanced navigation preserves the selected viewport, colour scheme, and
details disclosure. It collapses an expanded frame before installing the
destination. Filters and search stay unchanged when the destination is already
visible. Destination queries for the view axes and removed-entry snapshots
follow the [shell destination contract](./mokly-shell-destinations.md).

## Verification Contract

Coverage must prove:

- helper-level path/fragment separation and grammar, the HTML link forms,
  eligible native-link markers, metadata-only `data-nav-href`, rejection of
  logical `href` on resource and non-link elements and of `<base href>` in
  composed documents, dual navigation attributes, hashes, use-case paths,
  dark-to-light fallback, conflicts, and reserved-marker errors;
- identical document bytes in Serve and the static output, derived target
  metadata, secure target parsing, portable live attributes, and the shell's
  fragment transport with light and dark sources, scheme-toggle retention,
  and first-step use-case scoping;
- enhanced primary, keyboard, modified, non-self, Back, and Forward navigation
  from `MockLink`, raw HTML anchors and areas, SVG anchors, HTML screen links,
  mobile and desktop frames, flow steps, and page embeds, and safe degradation
  without outer navigation before the shell mounts or when the bundle fails;
- active-row selection, ancestor disclosure, conditional filter and search
  reset, nearest scrolling, responsive drawer closure, and preserved shell
  state; and
- continued script and top-navigation denial across direct, `srcdoc`, local,
  and cross-origin nested contexts; ancestor and named-context denial across
  HTML and SVG links, forms, marked, unmarked, download, and base targets;
  marked and unmarked links in every nested context ignored by outer
  navigation; frame-owned external, download and hash behaviour; and
  unchanged comparison-pane links.

## Related Docs

- [Shell delivery and read model routes](./mokly-shell-delivery.md)
- [HTML screens, pages, and use cases](./mokly-html-screens.md)
- [Package and authoring contract](./mokly-package.md)
- [Paths, roots, and identity](./mokly-paths.md)
- [Folders](./mokly-folders.md)
- [Shell destination queries](./mokly-shell-destinations.md)
- [Final logical link validation](./mokly-link-validation.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [Shell design contract](./mokly-shell-design.md)
- [Render pipeline](../architecture/build-pipeline.md)
