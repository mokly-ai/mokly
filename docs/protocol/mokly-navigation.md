# Mokly Catalogue Navigation Contract

## Delivery Status

This contract is implemented. Its delivery and verification history is recorded
in the completed
[in-frame catalogue link navigation plan](../../plans/in-frame-catalogue-link-navigation.md).

[Whole-document pages](./mokly-pages.md) use the same logical links, IDs,
source ownership, and collection ancestry as screens and use cases.

The [frame adapters](./mokly-frame-adapter.md) and `@mokly/viewer` package
are implemented. This document's same-origin interactions remain
authoritative. The outer shell is a hydrated React tree that renders routes
from the catalogue read model, as tracked in the
[React Browse shell plan](../../plans/react-browse-shell.md). Every marker,
sandbox, target-parsing and outer-navigation rule below applies to that shared
shell in Serve, export and embedded hosts.

## Scope

This document defines how links authored inside generated mockup documents
behave in portable output, served Browse, and the deployed Browse preview. It
also defines how the Browse shell keeps its route identity and catalogue tree
aligned after every navigation.

Mokly owns navigation between catalogue entries. Consumers continue to own
their product's application routes and the behavior of ordinary document,
asset, external, download, and same-document links.

## Component Navigation

Registered component ids share the existing catalogue namespace. Portable links
resolve to the first saved variant in the effective viewport and color scheme;
Browse opens the component page at its default variant. The [explorer contract](./mokly-component-explorer.md)
owns saved-variant and usage queries, removed variants, and selecting an actual
consumer instance. View/theme swaps replace iframe history; outer Back/Forward
continues between catalogue pages and saved variants. Only authenticated immediate
frames receive inspection/link enhancement. Temporary control documents retain
the same script-disabled boundary and do not grant nested frames shell access.

## Logical Catalogue Links

The opt-in `MockLink asChild` extension and its static-control adaptation
contract are specified in [Styled catalogue link controls](./mokly-link-controls.md).

The target helper API is `mockLink(id, fragment?)` and
`<MockLink to={id} fragment={fragment}>`. The id and optional fragment remain
separate authoring concepts: `to` and the first function argument contain only
the stable entry id, while `fragment` is a bare HTML id without `#` or
percent-encoding. The helper id must match the registry's lowercase kebab-case
grammar. The helpers reject overloaded or encoded target syntax such as
`id#fragment`, `id%23fragment`, or `mock:id` in `to` or the id argument; an
unknown but well-formed id fails later during the catalogue build. The helpers
emit a complete `mock:<id>[#fragment]` value, and authors may still use that raw
form in supported navigation attributes.

A complete document that contains an activatable logical `href` must not
contain an HTML `<base href>` element. The base URL would change the browser's
effective portable destination without changing the link attribute bytes that
Browse authenticates. The builder enforces this restriction both before and
after compatibility transformation. A metadata-only `data-nav-href` does not
activate the restriction, and `<base target>` remains supported under the
target rules below.

A logical `href` is valid only on an HTML `<a>`/`<area>` or SVG `<a>` and makes
that native link eligible for Browse activation. A logical `href` on every
other element, including HTML resource elements and SVG `use`/`image`, fails the
build instead of becoming an accidental resource request. Authors use
`data-nav-href` for metadata-only references; it is valid on any element but
does not invent click or keyboard semantics. A logical `data-nav-href` may
coexist with an eligible logical `href`, in which case both must name the same
destination. The entry's `route` is its current Browse location. A collection
remains an invalid destination. A use-case destination opens the use-case page,
even though its portable fragment fallback resolves through the first screen in
that use case.

A logical fragment begins with an ASCII letter and then contains only ASCII
letters, digits, `_`, `:`, `.`, or `-`. It names an HTML `id`, not a CSS
selector. The builder validates that it exists in every generated mobile,
desktop, light, and applicable dark artifact that Browse may show for the
destination screen. For a use case, this requirement applies to its first
screen. This cross-view rule lets one canonical outer route drive every visible
frame without silently losing the anchor in another viewport or color scheme.

The builder must:

- validate the destination id and optional fragment before writing output;
- rewrite the actual `href` and `data-nav-href` to the relative generated
  artifact for the source viewport and color scheme, retaining light fallback;
- add one package-owned `data-mokly-link` marker containing the original
  `<id>[#fragment]` destination only to an activatable native link; and
- reject a logical `href` on any other element, a `<base href>` in a document
  with an activatable logical link, a reserved marker supplied by consumer
  output, duplicate occurrences of either reserved navigation attribute, or
  conflicting logical destinations carried by two navigation attributes on
  one element.

Before invoking a compatibility transformer, the builder records a multiset of
complete logical-reference records: expected marker presence and value, the
native-link class (`html-a`, `html-area`, `svg-a`, or metadata-only), which of
`href` and `data-nav-href` carried the logical destination, and each such
attribute's resolved portable value. It reparses the transformed document and
requires the same multiset. Adding or removing a marker, preserving a marker
while changing its portable destination, element kind, or namespace, changing
a metadata-only reference into an activatable link, or moving logical identity
between navigation attributes fails the build. Unrelated attributes remain
consumer-owned. Duplicate reserved attributes are detected from the raw start
tag rather than the parser-normalized attribute map, so a transformer cannot
hide a second marker or target through HTML's first-attribute-wins parsing. A
transformer that adds `<base href>` to a document retaining an activatable
record also fails the build. After every document has been transformed, the
builder indexes anchors from the final documents and repeats cross-view
fragment validation for every retained logical-reference record. A transformer
that removes or renames an anchor in any destination viewport or scheme
therefore fails the build even when the source link record itself is unchanged.
The builder also requires every transformed screen fragment and page document
to retain a generated ownership header that decodes to its expected source
path. The versioned header encodes that identity with canonical base64 so no
source filename can alter HTML comment parsing. Header parsing accepts LF and
CRLF line endings. Final transformed output must retain the current encoded
form; safe legacy raw-path headers remain recognizable only for migration,
while a missing, malformed, downgraded, or changed source identity fails before
any output is written.

The marker is inert metadata, not a second resource URL. HTML escaping must be
deterministic, and link/resource validation continues to inspect the portable
attributes rather than treating the marker as a file reference.

Raw relative links do not become catalogue links merely because they happen to
resolve to a generated fragment. This keeps catalogue intent explicit and
prevents Mokly from taking over product or asset navigation accidentally.

## Portable And Comparison Output

Generated documents in both output modes keep their relative artifact `href`
values. They must remain navigable when opened directly or copied without the
Browse shell. Comparison snapshot trees copy the same portable documents and do
not promote their marked links into Browse routes; link activation inside a
comparison pane retains the existing sandbox behavior.

## Browse Presentation

When an eligible marked native link from a manifest-owned generated document is
presented beneath `/static/` in served Browse or in the deployed Browse preview,
Mokly authenticates its marker for trusted parent enhancement while retaining
the portable `href` and live `target`. The trusted-document set is exactly every
current manifest screen fragment, including dark fragments, plus every
generated page in that manifest. Its generated header must name the same
`sourcePath` as that manifest entry. The parent derives the canonical
`/id/<encoded-id>` or
`/id/<encoded-id>?fragment=<encoded-fragment>` destination from the marker; it
never trusts the portable URL as route identity. The adapter removes any
consumer-authored `data-mokly-target`, resolves the eligible link's effective
request from its own `target` or the document's applicable first `<base target>`,
parses it, and retains a valid non-self request only in newly derived inert
metadata. An invalid target receives no trusted metadata, so parent enhancement
declines it. A `download` link is not promoted, and `data-nav-href` without an
eligible logical `href` stays portable metadata rather than becoming a Browse
interaction.

The portable file on disk must not be mutated. The development server and
preview builder share one deterministic Browse-document adapter for marker
authentication and derived target metadata. Every HTML response or preview
copy beneath `/static/` passes through it. Only a route in the trusted set above
whose bytes retain that matching ownership header may promote a marker. The
adapter recomputes the source view's expected portable `href` and requires the
marked link to match it exactly. On any other HTML route, including
consumer-authored unowned files, it removes `data-mokly-link` and
`data-mokly-target` from the adapted copy and never promotes them; removal
covers every raw occurrence even when HTML parsing hides duplicates. A missing
or mismatched ownership header, duplicate reserved attribute, malformed or
manifest-invalid marker, or mismatched portable `href` on a trusted route
yields HTTP 500 without serving that document and fails the preview build. A
trusted document that carries an activatable marker and `<base href>` fails
closed by the same rule, defending against post-build tampering. Neither
environment promotes an unmarked relative link or rewrites a live `href`,
`target`, `formtarget`, or `<base target>`.

One pure target parser is shared by the adapter and parent client. It does not
trim its input and returns exactly one typed state:

- absent, empty, or an ASCII-case-insensitive `_self` is `self`;
- ASCII-case-insensitive `_top`, `_parent`, and `_blank` are their corresponding
  reserved states;
- `/^[A-Za-z0-9][A-Za-z0-9._:-]*$/` is a named target, preserving its case; and
- every other value, including whitespace or control characters, is invalid.

The parent reparses adapter-produced target metadata with this same contract
and declines an invalid or context-inappropriate state.

Default same-origin Browse grants a fragment frame access only so trusted parent code
can inspect its immediate document. It never grants `allow-top-navigation`,
`allow-top-navigation-by-user-activation`, `allow-popups`, `allow-forms`,
`allow-scripts`, or `allow-downloads`. The top-navigation restriction remains
active for the generated document and is inherited by every descendant
browsing context it creates, including `srcdoc`, local, and cross-origin child
frames. Consumer-authored `_top`, `_parent`, named, `<base target>`, and
`formtarget` values therefore cannot replace the shell even when they live in
nested content the adapter cannot inspect. Trusted parent code is the only
outer-navigation authority. Portable and comparison documents retain their original
bytes and comparisons keep its stricter sandbox.

In served Browse, the `/id/<id>` redirect preserves the optional
request-visible `fragment` query on
`/view/<route>?fragment=<encoded-fragment>`. The server accepts at most one
value, decodes it exactly once, checks the grammar and cross-view anchor
existence above, and returns HTTP 400 without injecting a fragment when
validation fails. It renders the validated value as an encoded hash on every
current screen iframe source and its light/dark swap sources. A use-case page
applies it only to the first step, matching the portable fallback. The query
remains on the outer history URL while scheme changes retain the iframe hashes.

The deployed preview is a static snapshot and has no request handler that can
render query-dependent HTML. Its hydrated parent shell reads at most one
`fragment` value from the URL, validates the grammar, and renders the encoded
hash into `src`, `data-fragment-light`, and `data-fragment-dark` wherever each
attribute exists on every current screen frame. On a use-case page it updates only the first
step. Authored links already carry the builder's cross-view anchor proof, and
updating every swap source preserves the anchor through light/dark changes. A
direct preview URL whose syntactically valid fragment names no anchor simply
remains at the top of that frame. Without parent enhancement, served and preview
links keep their portable in-frame behavior; neither environment promises outer
page navigation or logical-fragment transport from a click. A top-level
`#fragment` is never logical-fragment transport because URL hashes are not sent
in an HTTP request.

## Enhanced Navigation And Safe Degradation

With the hydrated shell available, an unmodified primary or keyboard
activation of a default/`_self` marked link asks the outer shell to navigate
through its latest-wins route transition. The shell resolves the destination in
its catalogue read model and renders it; it does not fetch a shell document.
The resulting history entry has the canonical `/view/<route>[?fragment=...]`
URL; the title, breadcrumbs, heading, details inspector, frames, focus, and
status announcement all describe the destination. Back and Forward return
through those outer route entries and restore their route-owned scroll.
Once React owns a same-origin frame session, that ownership is continuous while
the adapter replaces its document. The shell installs its navigation receiver
on the still-visible document before starting the replacement, so a valid
marked activation during a viewport, scheme, variant, fragment, or route
handoff still navigates the parent exactly once. Readiness gates inspection,
not logical navigation. Disposing or unsubscribing the session removes the
receiver; before hydration, after failed hydration, or without a receiver, the
portable link remains frame-owned as described below.

Outer same-document links, including the shell's skip link, keep native fragment
focus and scrolling. Document identity includes origin, pathname and query but
excludes the hash. A history event within the displayed document must not
change the rendered route, reinstall its workspace, or move focus away from
the native target. It invalidates any pending route transition so an obsolete
result cannot replace the retained view. Saved scroll positions may be
restored without a reload. A changed route or query still uses in-shell
navigation and its normal history restoration.

For exported catalogues the shared delivery resolver maps that trusted id to
the exact `/view/<route>.html` URL in shell-owned metadata before rendering or
opening any context. Development still follows the `/id` redirect. Real static
id aliases show full content without JavaScript and normalize their history
entry once hydrated; see [Static export delivery](./mokly-export-delivery.md).

The same trusted parent enhancement exclusively handles modified pointer
activation and explicit non-self targets after validating the marker and
canonical destination. Modified activation includes Meta-, Ctrl-, or
Shift-modified click and middle-button `auxclick` (`button === 1`). A requested
`_top` or `_parent` uses the normal outer route transition. When a new or named
browsing context is requested, package-owned parent code opens the canonical
Mokly URL with `noopener`; it never delegates popup creation to the consumer
frame. If the shell is not hydrated or hydration fails, the portable live link
remains frame-owned and subject to the sandbox; Mokly does not grant native
outer-navigation fallback.

Consumer scripts remain disabled in default Browse. It permits same-origin inspection but
does not grant script, form, popup, download, or either top-navigation
capability to consumer documents. Comparison panes retain their stricter existing
sandbox.

External, raw relative, download, same-document hash, metadata-only, and
unmarked links retain their existing frame-owned behavior subject to the
sandbox. Consumer-authored targets remain byte-preserved, but the sandbox denies
their access to the outer shell and to popups. Mokly must not infer product
navigation from URLs, `data-nav-href`, or visible labels.

### Frame Adapter Boundary

The implemented `sameOriginAdapter` preserves this existing behavior;
direct `contentDocument` access lives behind the local transport interface.
The viewer package exposes the same boundary. Logical fragment scope is resolved
once in the frame URL boundary shared by public markup and adapter mounts:
standalone views receive the fragment; flows apply it only to step zero,
including across scheme and viewport changes. Logical target
parsing, marker/ownership checks, modifier/target classification, canonical
routes and safe degradation do not change. No adapter gains nested-frame access.
The optional `postMessageAdapter` requires a separate, nonopaque frame origin
and the [inspector handshake](./mokly-frame-adapter.md#cross-origin-mount-and-handshake).
It carries bounded logical ids/fragments and activation/target states, never
consumer hrefs, labels or arbitrary navigation URLs. The host revalidates the
destination against its catalogue and owns the navigation action; the inspector
never reads or changes `window.top` or `parent.location`. Cross-origin hosts
grant `allow-same-origin allow-scripts` only under that explicit contract;
default local Browse and all comparison snapshot restrictions remain unchanged.

## Active Catalogue Visibility

Every successful outer route change, including in-shell navigation, Back,
and Forward, establishes one navigation invariant: when the route has a
catalogue row, that row is visible and marked `aria-current="page"`.

To establish the invariant, Browse must:

1. remove `aria-current` from every other row;
2. open each ancestor `details[data-nav-disclosure]` of the active row,
   including its Pages or Components section;
3. preserve unrelated collection disclosures;
4. clear a search query only when it would hide the destination;
5. switch Changes to All only when the destination is not changed;
6. reapply navigation visibility after those adjustments; and
7. scroll the active row into the nearest visible part of the catalogue pane.

The responsive drawer closes after navigation so it does not cover the new
screen. Its tree retains the opened destination path for the next time it is
opened. A user may collapse the active path afterward; the next route change
re-establishes the invariant.

Each user edit to search or the All/Changes filter opens groups to reveal the
rows matching the updated constraints. Reapplying the same active constraints
during a route change or watched-reload restoration must instead preserve
groups the user subsequently collapsed; only the destination row's ancestor
path may be reopened. Clearing every filtering constraint restores the
disclosure state captured before filtering began, except that an ancestor
opened for the navigated destination remains open so the active row stays
visible.

Enhanced navigation preserves the selected viewport, color scheme, and details
disclosure. It collapses an expanded frame before installing the destination.
Filters and search remain unchanged when the destination is already visible.

## Verification Contract

Coverage must prove:

- helper-level id/fragment separation and id grammar, portable output, eligible
  native-link markers, metadata-only `data-nav-href`, rejection of logical
  `href` on resource/non-link elements, rejection of `<base href>` before and
  after compatibility transformation, dual navigation attributes, hashes,
  use-case ids, dark-to-light fallback, conflicts, and reserved-marker errors;
- served and preview adaptation without mutating generated fragments, including
  LF/CRLF ownership-gated promotion, unowned reserved-metadata removal, secure
  target parsing, portable live attributes, and request-visible fragment
  transport;
- served cross-view fragment validation and JavaScript-disabled anchor
  injection, plus enhanced static-preview current/swap-source injection,
  scheme-toggle retention, and first-step use-case scoping;
- enhanced primary, keyboard, modified, non-self, Back, and Forward navigation
  from `MockLink`, raw HTML anchors and areas, SVG anchors, mobile and desktop
  frames, flow steps, and generated page embeds;
- safe degradation without outer navigation when the shell is not hydrated
  or hydration fails;
- active-row selection, ancestor disclosure, conditional filter/search reset,
  nearest scrolling, responsive drawer closure, and preserved shell state; and
- continued script denial and top-navigation denial across direct, `srcdoc`,
  local, and cross-origin nested contexts; ancestor/named-context denial across
  HTML and SVG links, forms, marked, unmarked, download, and base targets;
  marked and unmarked links in every nested context ignored by outer navigation;
  frame-owned external/download/hash behavior; and unchanged comparison-pane links.

## Related Docs

- [Package and authoring contract](./mokly-package.md)
- [Build and Browse runtime](./mokly-runtime.md)
- [Shell design contract](./mokly-shell-design.md)
- [Build pipeline](../architecture/build-pipeline.md)
